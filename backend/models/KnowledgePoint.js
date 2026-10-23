const { runDatabaseRequest } = require('../config/cloudbase');

const COLLECTION = 'knowledge_points';

function documentsFrom(result) {
  if (Array.isArray(result.data)) return result.data;
  return result.data ? [result.data] : [];
}

async function readDocument(db, id) {
  try {
    const result = await db.collection(COLLECTION).doc(id).get();
    return documentsFrom(result)[0] || null;
  } catch (error) {
    if (error.code === 'DOCUMENT_NOT_FOUND') return null;
    throw error;
  }
}

async function create(
  {
    user,
    title,
    content,
    status = 'not_started',
    reviewList = false,
    category = '',
    tags = [],
  },
  documentId,
) {
  return runDatabaseRequest(async (db) => {
    const now = new Date();
    const knowledgePoint = {
      ...(documentId ? { _id: documentId } : {}),
      user,
      title,
      content,
      status,
      reviewList,
      category,
      tags,
      revision: 1,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection(COLLECTION).add(knowledgePoint);
    return { ...knowledgePoint, _id: result.id };
  });
}

async function findById(id) {
  return runDatabaseRequest((db) => readDocument(db, id));
}

async function findByUser(userId) {
  return runDatabaseRequest(async (db) => {
    const documents = [];
    const pageSize = 100;
    while (true) {
      const result = await db
        .collection(COLLECTION)
        .where({ user: userId })
        .field({ history: false })
        .orderBy('createdAt', 'desc')
        .orderBy('_id', 'asc')
        .skip(documents.length)
        .limit(pageSize)
        .get();
      const page = documentsFrom(result);
      documents.push(...page);
      if (page.length < pageSize) return documents;
    }
  });
}

// 同一文档内原子替换正文与历史，版本条件阻止并发保存覆盖。
function snapshot(point) {
  return {
    version: point.revision || point.version || 1,
    savedAt: point.updatedAt || point.savedAt || point.createdAt,
    title: point.title,
    content: point.content,
    status: point.status,
    reviewList: point.reviewList,
    category: point.category || '',
    tags: point.tags || [],
  };
}
async function updateById(point, fields) {
  return runDatabaseRequest(async (db) => {
    const history = [...(point.history || []), snapshot(point)].slice(-10);
    while (
      history.length &&
      Buffer.byteLength(JSON.stringify(history), 'utf8') > 300000
    )
      history.shift();
    const result = await db
      .collection(COLLECTION)
      .where({
        _id: point._id,
        revision:
          point.revision === undefined
            ? db.command.exists(false)
            : point.revision,
      })
      .update({
        ...fields,
        revision: (point.revision || 1) + 1,
        history,
        updatedAt: new Date(),
      });
    if (!result.updated) return null;
    return readDocument(db, point._id);
  });
}

async function deleteById(id) {
  return runDatabaseRequest((db) => db.collection(COLLECTION).doc(id).remove());
}

module.exports = {
  snapshot,
  create,
  deleteById,
  findById,
  findByUser,
  updateById,
};
