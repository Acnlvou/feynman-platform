const KnowledgePoint = require('../models/KnowledgePoint');
const { createHash } = require('node:crypto');
const vectorStore = require('./vectorStoreService');
const FIELDS = ['title', 'content', 'status', 'reviewList', 'category', 'tags'];
const STATUSES = ['not_started', 'in_progress', 'mastered'];
const MAX_VECTOR_INDEX_JOBS = 2;
const vectorQueue = [];
const vectorJobs = new Map();
let activeVectorJobs = 0;

function vectorJobKey(user, id) {
  return JSON.stringify([user, id]);
}

function safeIndexErrorCode(error) {
  const code = error?.code;
  return typeof code === 'string' && /^[A-Z0-9_.-]{1,80}$/.test(code)
    ? code
    : 'VECTOR_INDEX_FAILED';
}

function enqueueVectorIndex(point, { force = false } = {}) {
  const key = vectorJobKey(point.user, point._id);
  const current = vectorJobs.get(key);
  if (current) {
    current.rerun = true;
    current.forceNext ||= force;
    return;
  }
  const job = {
    key,
    user: point.user,
    id: point._id,
    forceNext: force,
    rerun: false,
  };
  vectorJobs.set(key, job);
  vectorQueue.push(job);
  pumpVectorQueue();
}

function pumpVectorQueue() {
  while (
    activeVectorJobs < MAX_VECTOR_INDEX_JOBS &&
    vectorQueue.length > 0
  ) {
    const job = vectorQueue.shift();
    activeVectorJobs += 1;
    void runVectorIndexJob(job)
      .catch((error) => {
        console.warn('[vector-index] job stopped:', safeIndexErrorCode(error));
      })
      .finally(() => {
        if (vectorJobs.get(job.key) === job) vectorJobs.delete(job.key);
        activeVectorJobs -= 1;
        pumpVectorQueue();
      });
  }
}

async function runVectorIndexJob(job) {
  const trace = createHash('sha256').update(job.key).digest('hex').slice(0, 10);
  while (true) {
    job.rerun = false;
    const force = job.forceNext;
    job.forceNext = false;
    try {
      // Keep the initial CloudBase read inside the worker's failure handler.
      // Otherwise a transient read error drops the in-memory job and leaves the
      // persisted vectorIndexStatus stuck at `pending`.
      let point = await KnowledgePoint.findById(job.id);
      if (!point || point.user !== job.user || point.deleting) return;
      console.info(`[vector-index:${trace}] note loaded`);

      const isCurrent = !force && (await vectorStore.isIndexCurrent(point));
      if (isCurrent) {
        const saved = await KnowledgePoint.setVectorIndexState(
          point._id,
          point.user,
          point.revision,
          {
            status: 'ready',
            indexedRevision: vectorStore.contentRevision(point),
            model: vectorStore.currentModel(),
          },
        );
        if (saved && !job.rerun) return;
        continue;
      }

      const marked = await KnowledgePoint.setVectorIndexState(
        point._id,
        point.user,
        point.revision,
        { status: 'pending' },
      );
      if (!marked) {
        const latest = await KnowledgePoint.findById(job.id);
        if (!latest || latest.user !== job.user || latest.deleting) return;
        if (
          latest.revision !== point.revision ||
          latest.vectorIndexStatus !== 'pending'
        ) {
          continue;
        }
        // CloudBase may report updated: 0 when the document is already pending.
        // The state is valid; proceed with the build instead of spinning forever.
        point = latest;
      }

      console.info(`[vector-index:${trace}] index build started`);
      const result = await vectorStore.indexKnowledgePoint(point, { force });
      console.info(`[vector-index:${trace}] index build finished: ${result.status}`);
      const latest = await KnowledgePoint.findById(job.id);
      if (!latest || latest.user !== job.user || latest.deleting) return;
      if (
        result.status !== 'ready' ||
        vectorStore.contentRevision(latest) !== result.revision
      ) {
        continue;
      }

      const saved = await KnowledgePoint.setVectorIndexState(
        latest._id,
        latest.user,
        latest.revision,
        {
          status: 'ready',
          indexedRevision: result.revision,
          model: result.model,
        },
      );
      if (saved) console.info(`[vector-index:${trace}] ready state saved`);
      if (saved && !job.rerun) return;
    } catch (error) {
      console.warn(`[vector-index:${trace}] job failed: ${safeIndexErrorCode(error)}`);
      const latest = await KnowledgePoint.findById(job.id).catch(() => null);
      if (latest?.user === job.user && !latest.deleting) {
        const saved = await KnowledgePoint.setVectorIndexState(
          latest._id,
          latest.user,
          latest.revision,
          { status: 'failed', errorCode: safeIndexErrorCode(error) },
        ).catch(() => false);
        if (!saved && !job.rerun) return;
      } else {
        return;
      }
      if (!job.rerun) return;
    }
  }
}

async function markVectorIndexPending(point) {
  let current = point;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const saved = await KnowledgePoint.setVectorIndexState(
      current._id,
      current.user,
      current.revision,
      { status: 'pending' },
    );
    if (saved) return current;
    current = await KnowledgePoint.findById(point._id);
    if (!current || current.user !== point.user || current.deleting) return null;
  }
  return current;
}
function failure(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function validate(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw failure('知识点必须为对象');
  const result = {};
  for (const field of ['title', 'content', 'category']) {
    if (partial && input[field] === undefined) continue;
    const value = input[field] ?? (field === 'category' ? '' : undefined);
    if (typeof value !== 'string')
      throw failure(
        `${field === 'title' ? '标题' : field === 'content' ? '正文' : '分类'}必须为文本`,
      );
    const normalized = field === 'content' ? value : value.trim();
    const limit = field === 'content' ? 20000 : field === 'title' ? 120 : 40;
    if (
      (field !== 'category' && !normalized.trim()) ||
      normalized.length > limit
    )
      throw failure(
        `${field === 'title' ? '标题' : field === 'content' ? '正文' : '分类'}不能为空或超过 ${limit} 字符`,
      );
    result[field] = normalized;
  }
  if (!partial || input.status !== undefined) {
    if (!STATUSES.includes(input.status ?? 'not_started'))
      throw failure('知识点状态不正确');
    result.status = input.status ?? 'not_started';
  }
  if (!partial || input.reviewList !== undefined) {
    if (input.reviewList !== undefined && typeof input.reviewList !== 'boolean')
      throw failure('复习标记必须为布尔值');
    result.reviewList = input.reviewList ?? false;
  }
  if (!partial || input.tags !== undefined) {
    const tags = input.tags ?? [];
    if (
      !Array.isArray(tags) ||
      tags.length > 10 ||
      tags.some(
        (tag) =>
          typeof tag !== 'string' || !tag.trim() || tag.trim().length > 20,
      )
    )
      throw failure('标签最多 10 个，每个为 1–20 字符');
    result.tags = [...new Set(tags.map((tag) => tag.trim()))];
  }
  return result;
}
function publicPoint(point) {
  if (!point) return null;
  const { history, deleting, ...data } = point;
  return {
    ...data,
    category: data.category || '',
    tags: data.tags || [],
    revision: data.revision || 1,
    contentRevision: data.contentRevision || data.revision || 1,
    vectorIndexStatus: data.vectorIndexStatus || 'unindexed',
    vectorIndexedRevision: data.vectorIndexedRevision ?? null,
    vectorIndexModel: data.vectorIndexModel ?? null,
    vectorIndexErrorCode: data.vectorIndexErrorCode ?? null,
  };
}
function exportFields(point) {
  return Object.fromEntries(
    FIELDS.map((field) => [field, publicPoint(point)[field]]),
  );
}
async function owned(id, user, { allowDeleting = false } = {}) {
  if (typeof id !== 'string' || !id || id.length > 128)
    throw failure('知识点编号不正确');
  const point = await KnowledgePoint.findById(id);
  if (!point) throw failure('知识点不存在', 404);
  if (point.user !== user) throw failure('无权操作他人的知识点', 403);
  if (point.deleting && !allowDeleting)
    throw failure('该知识点正在删除，请在知识库完成删除后重试', 409);
  return point;
}
async function create(user, input) {
  const point = await KnowledgePoint.create({ user, ...validate(input) });
  enqueueVectorIndex(point);
  return publicPoint(point);
}
async function update(point, input) {
  const suppliedFields = validate(input, true);
  if (
    input.revision !== undefined &&
    (!Number.isInteger(input.revision) ||
      input.revision !== (point.revision || 1))
  )
    throw failure('内容已在其他页面更新，请重新打开后再保存', 409);
  const fields = Object.fromEntries(
    Object.entries(suppliedFields).filter(
      ([key, value]) =>
        JSON.stringify(value) !==
        JSON.stringify(publicPoint(point)[key]),
    ),
  );
  const changed = Object.keys(fields).length > 0;
  if (!changed) return publicPoint(point);
  const contentChanged = ['title', 'content'].some((field) =>
    Object.hasOwn(fields, field),
  );
  if (contentChanged) {
    fields.vectorIndexStatus = 'pending';
    fields.vectorIndexErrorCode = null;
  }
  const result = await KnowledgePoint.updateById(point, fields);
  if (!result) throw failure('内容已发生变化，请重新加载后再操作', 409);
  if (contentChanged) enqueueVectorIndex(result);
  return publicPoint(result);
}
function history(point) {
  return [
    KnowledgePoint.snapshot(point),
    ...(point.history || []).slice().reverse(),
  ];
}
async function restore(point, version, revision) {
  if (!Number.isInteger(version) || !Number.isInteger(revision))
    throw failure('版本编号不正确');
  const entry = history(point).find((item) => item.version === version);
  if (!entry) throw failure('版本不存在或已超出保留范围', 404);
  return update(point, { ...exportFields(entry), revision });
}
async function importPoints(user, body) {
  if (
    !body ||
    body.format !== 'feynman-knowledge' ||
    body.version !== 1 ||
    !Array.isArray(body.knowledgePoints) ||
    !body.knowledgePoints.length ||
    body.knowledgePoints.length > 30
  )
    throw failure('备份格式不正确，一次可导入 1–30 条知识点');
  // 全部校验后才开始创建；导入只创建副本，忽略外部用户、编号和历史。
  const records = body.knowledgePoints.map((record) => validate(record));
  if (
    body.importKeys !== undefined &&
    (!Array.isArray(body.importKeys) ||
      body.importKeys.length !== records.length ||
      body.importKeys.some(
        (key) => typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(key),
      ))
  )
    throw failure('导入标识不正确');
  const created = [],
    failed = [];
  for (let index = 0; index < records.length; index++) {
    try {
      const key = body.importKeys?.[index];
      const id = key
        ? createHash('sha256')
            .update(JSON.stringify([user, key, records[index]]))
            .digest('hex')
            .slice(0, 32)
        : undefined;
      // 相同导入项的重试使用同一编号，响应丢失时不会重复创建。
      let point = id ? await KnowledgePoint.findById(id) : null;
      if (!point) {
        try {
          point = await KnowledgePoint.create({ user, ...records[index] }, id);
        } catch (error) {
          point = id ? await KnowledgePoint.findById(id) : null;
          if (!point) throw error;
        }
      }
      if (point.user !== user) throw failure('导入记录归属不正确', 403);
      if (point.deleting) throw failure('该知识点正在删除', 409);
      enqueueVectorIndex(point);
      created.push({ index, point: publicPoint(point) });
    } catch (error) {
      failed.push({ index, message: '该条导入失败，请稍后重试' });
    }
  }
  return { created, failed };
}

async function reindexPoint(id, user) {
  let point = await owned(id, user);
  if (await vectorStore.isIndexCurrent(point)) {
    const saved = await KnowledgePoint.setVectorIndexState(
      point._id,
      point.user,
      point.revision,
      {
        status: 'ready',
        indexedRevision: vectorStore.contentRevision(point),
        model: vectorStore.currentModel(),
      },
    );
    if (saved) {
      return {
        knowledgePointId: point._id,
        status: 'ready',
        revision: vectorStore.contentRevision(point),
      };
    }
    point = await owned(id, user);
  }
  const current = await markVectorIndexPending(point);
  if (!current) throw failure('该知识点正在删除，无法重建索引', 409);
  enqueueVectorIndex(current);
  return {
    knowledgePointId: current._id,
    status: 'pending',
    revision: vectorStore.contentRevision(current),
  };
}

async function reindexAll(user) {
  const points = await KnowledgePoint.findByUser(user);
  const items = [];
  const failed = [];
  for (const point of points) {
    if (point.user !== user || point.deleting) continue;
    try {
      const current = await markVectorIndexPending(point);
      if (!current) continue;
      enqueueVectorIndex(current, { force: true });
      items.push({
        knowledgePointId: current._id,
        status: 'pending',
        revision: vectorStore.contentRevision(current),
      });
    } catch (error) {
      failed.push({
        knowledgePointId: point._id,
        status: 'failed',
        errorCode: safeIndexErrorCode(error),
      });
    }
  }
  return { scheduled: items.length, items, failed };
}

module.exports = {
  validate,
  publicPoint,
  exportFields,
  owned,
  create,
  update,
  history,
  restore,
  importPoints,
  reindexPoint,
  reindexAll,
};
