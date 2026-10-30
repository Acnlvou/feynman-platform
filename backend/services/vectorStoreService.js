const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { HierarchicalNSW } = require('hnswlib-node');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const KnowledgePoint = require('../models/KnowledgePoint');
const embeddings = require('./siliconflowEmbeddings');

const STORE_ROOT = path.join(__dirname, '..', '.data', 'vector_store');
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const INDEX_FORMAT_VERSION = 2;
const SPLITTER_NAME = 'langchain-RecursiveCharacterTextSplitter';
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});
const locks = new Map();

function indexKey(user, knowledgePointId) {
  return createHash('sha256')
    .update(JSON.stringify([user, knowledgePointId]))
    .digest('hex');
}

function pointDirectory(user, knowledgePointId) {
  return path.join(STORE_ROOT, indexKey(user, knowledgePointId));
}

function contentRevision(point) {
  return point.contentRevision || point.revision || 1;
}

async function splitText(content) {
  const source = (typeof content === 'string' ? content : '').trim();
  if (!source) return [];
  const chunks = await textSplitter.splitText(source);
  return chunks.filter((chunk) => chunk.trim());
}

async function withPointLock(user, knowledgePointId, operation) {
  const key = indexKey(user, knowledgePointId);
  const previous = locks.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  locks.set(key, current);
  try {
    return await current;
  } finally {
    if (locks.get(key) === current) locks.delete(key);
  }
}

async function readManifest(directory) {
  try {
    return JSON.parse(
      await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'),
    );
  } catch {
    return null;
  }
}

async function loadIndex(point) {
  if (!point || typeof point.user !== 'string' || typeof point._id !== 'string') {
    return null;
  }
  const directory = pointDirectory(point.user, point._id);
  try {
    const manifest = await readManifest(directory);
    if (
      !manifest ||
      manifest.formatVersion !== INDEX_FORMAT_VERSION ||
      manifest.splitter !== SPLITTER_NAME ||
      manifest.chunkSize !== CHUNK_SIZE ||
      manifest.chunkOverlap !== CHUNK_OVERLAP ||
      manifest.user !== point.user ||
      manifest.knowledgePointId !== point._id ||
      manifest.revision !== contentRevision(point) ||
      manifest.model !== embeddings.currentModel() ||
      !Number.isInteger(manifest.dimension) ||
      manifest.dimension < 1 ||
      manifest.dimension > 65536 ||
      !Number.isInteger(manifest.chunkCount) ||
      manifest.chunkCount < 1 ||
      manifest.chunkCount > 1000
    ) {
      return null;
    }

    const stored = JSON.parse(
      await fs.readFile(path.join(directory, 'chunks.json'), 'utf8'),
    );
    if (
      !Array.isArray(stored?.documents) ||
      stored.documents.length !== manifest.chunkCount ||
      stored.documents.some(
        (document, chunkIndex) =>
          document?.label !== chunkIndex ||
          typeof document.text !== 'string' ||
          document.metadata?.user !== point.user ||
          document.metadata?.knowledgePointId !== point._id ||
          document.metadata?.revision !== contentRevision(point) ||
          document.metadata?.chunkIndex !== chunkIndex,
      )
    ) {
      return null;
    }

    const index = new HierarchicalNSW('cosine', manifest.dimension);
    index.readIndexSync(path.join(directory, 'index.bin'));
    const labels = index.getIdsList().sort((left, right) => left - right);
    if (
      index.getNumDimensions() !== manifest.dimension ||
      index.getCurrentCount() !== manifest.chunkCount ||
      labels.length !== manifest.chunkCount ||
      labels.some((label, chunkIndex) => label !== chunkIndex)
    ) {
      return null;
    }
    return { index, documents: stored.documents, manifest };
  } catch {
    return null;
  }
}

async function isIndexCurrent(point) {
  return Boolean(await loadIndex(point));
}

function currentModel() {
  return embeddings.currentModel();
}

async function writeIndex(point, force) {
  const trace = createHash('sha256')
    .update(JSON.stringify([point.user, point._id]))
    .digest('hex')
    .slice(0, 10);
  const current = await KnowledgePoint.findById(point._id);
  if (
    !current ||
    current.user !== point.user ||
    current.deleting ||
    contentRevision(current) !== contentRevision(point)
  ) {
    return {
      status: 'superseded',
      revision: current ? contentRevision(current) : contentRevision(point),
      chunkCount: 0,
      model: embeddings.currentModel(),
    };
  }

  if (!force && (await isIndexCurrent(current))) {
    return {
      status: 'ready',
      revision: contentRevision(current),
      chunkCount: (await readManifest(pointDirectory(point.user, point._id)))?.chunkCount || 0,
      model: embeddings.currentModel(),
      unchanged: true,
    };
  }

  const model = embeddings.currentModel();
  const chunks = await splitText(current.content);
  console.info(`[vector-index:${trace}] split into ${chunks.length} chunks`);
  if (!chunks.length) {
    throw Object.assign(new Error('知识点正文没有可索引内容'), {
      code: 'EMPTY_KNOWLEDGE_POINT',
      status: 400,
    });
  }

  console.info(`[vector-index:${trace}] Embedding request started`);
  const vectors = await embeddings.embedTexts(chunks);
  console.info(`[vector-index:${trace}] Embedding request finished`);
  const dimension = vectors[0]?.length;
  if (
    !dimension ||
    vectors.length !== chunks.length ||
    vectors.some((vector) => vector.length !== dimension)
  ) {
    throw Object.assign(new Error('向量服务返回的数据不完整'), {
      code: 'INVALID_EMBEDDING_RESULT',
      status: 503,
    });
  }

  const index = new HierarchicalNSW('cosine', dimension);
  index.initIndex(vectors.length);
  const documents = chunks.map((text, chunkIndex) => ({
    label: chunkIndex,
    text,
    metadata: {
      user: current.user,
      knowledgePointId: current._id,
      revision: contentRevision(current),
      chunkIndex,
      title: current.title,
    },
  }));
  vectors.forEach((vector, label) => index.addPoint(vector, label));

  await fs.mkdir(STORE_ROOT, { recursive: true, mode: 0o700 });
  await fs.chmod(STORE_ROOT, 0o700);
  const target = pointDirectory(current.user, current._id);
  const temporary = path.join(
    STORE_ROOT,
    '.' + indexKey(current.user, current._id) + '.' + randomUUID() + '.tmp',
  );
  await fs.mkdir(temporary, { recursive: true, mode: 0o700 });

  try {
    index.writeIndexSync(path.join(temporary, 'index.bin'));
    await fs.chmod(path.join(temporary, 'index.bin'), 0o600);
    await fs.writeFile(
      path.join(temporary, 'chunks.json'),
      JSON.stringify({ documents }),
      { mode: 0o600 },
    );
    await fs.writeFile(
      path.join(temporary, 'manifest.json'),
      JSON.stringify({
        formatVersion: INDEX_FORMAT_VERSION,
        splitter: SPLITTER_NAME,
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        user: current.user,
        knowledgePointId: current._id,
        revision: contentRevision(current),
        model,
        dimension,
        chunkCount: chunks.length,
        indexedAt: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );

    const latest = await KnowledgePoint.findById(current._id);
    if (
      !latest ||
      latest.user !== current.user ||
      latest.deleting ||
      contentRevision(latest) !== contentRevision(current)
    ) {
      await fs.rm(temporary, { recursive: true, force: true });
      return {
        status: 'superseded',
        revision: latest ? contentRevision(latest) : contentRevision(current),
        chunkCount: 0,
        model,
      };
    }

    await replaceDirectory(temporary, target);
    console.info(`[vector-index:${trace}] local index saved`);
    const afterReplace = await KnowledgePoint.findById(current._id);
    if (
      !afterReplace ||
      afterReplace.user !== current.user ||
      afterReplace.deleting
    ) {
      await fs.rm(target, { recursive: true, force: true });
      return {
        status: 'superseded',
        revision: afterReplace
          ? contentRevision(afterReplace)
          : contentRevision(current),
        chunkCount: 0,
        model,
      };
    }
    if (contentRevision(afterReplace) !== contentRevision(current)) {
      return {
        status: 'superseded',
        revision: contentRevision(afterReplace),
        chunkCount: 0,
        model,
      };
    }
    return {
      status: 'ready',
      revision: contentRevision(current),
      chunkCount: chunks.length,
      model,
      dimension,
    };
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function replaceDirectory(temporary, target) {
  const backup = target + '.old-' + randomUUID();
  let movedOld = false;
  try {
    await fs.rename(target, backup);
    movedOld = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    await fs.rename(temporary, target);
  } catch (error) {
    if (movedOld) await fs.rename(backup, target).catch(() => {});
    throw error;
  }

  if (movedOld) await fs.rm(backup, { recursive: true, force: true });
}

async function indexKnowledgePoint(point, { force = false } = {}) {
  if (!point || typeof point.user !== 'string' || typeof point._id !== 'string') {
    throw Object.assign(new Error('知识点索引参数不正确'), {
      code: 'INVALID_INDEX_TARGET',
      status: 400,
    });
  }
  return withPointLock(point.user, point._id, () => writeIndex(point, force));
}

async function removeKnowledgePoint(user, knowledgePointId) {
  return withPointLock(user, knowledgePointId, async () => {
    const key = indexKey(user, knowledgePointId);
    let entries;
    try {
      entries = await fs.readdir(STORE_ROOT);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    const related = entries.filter(
      (entry) =>
        entry === key ||
        entry.startsWith(key + '.old-') ||
        entry.startsWith('.' + key + '.'),
    );
    await Promise.all(
      related.map((entry) =>
        fs.rm(path.join(STORE_ROOT, entry), { recursive: true, force: true }),
      ),
    );
  });
}

module.exports = {
  contentRevision,
  currentModel,
  indexKnowledgePoint,
  isIndexCurrent,
  loadIndex,
  removeKnowledgePoint,
  splitText,
};
