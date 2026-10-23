const { createHash } = require('node:crypto');
const { runDatabaseRequest } = require('../config/cloudbase');
const COLLECTION = 'feynman_attempts';
async function request(operation) {
  try {
    return await runDatabaseRequest(operation);
  } catch (error) {
    error.collectionName = COLLECTION;
    throw error;
  }
}
const documents = (result) =>
  Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];

function documentId(user, knowledgePointId, saveKey) {
  return createHash('sha256')
    .update(JSON.stringify([user, knowledgePointId, saveKey]))
    .digest('hex')
    .slice(0, 32);
}
async function findById(id) {
  return request(async (db) => {
    try {
      return (
        documents(await db.collection(COLLECTION).doc(id).get())[0] || null
      );
    } catch (error) {
      if (error.code === 'DOCUMENT_NOT_FOUND') return null;
      throw error;
    }
  });
}
async function create(id, fields) {
  return request(async (db) => {
    const record = { ...fields, _id: id, createdAt: new Date() };
    await db.collection(COLLECTION).add(record);
    return record;
  });
}
async function recent(user, knowledgePointId) {
  return request(async (db) =>
    documents(
      await db
        .collection(COLLECTION)
        .where({ user, knowledgePointId })
        .orderBy('createdAt', 'desc')
        .orderBy('_id', 'asc')
        .limit(20)
        .get(),
    ),
  );
}
async function remove(id) {
  return request((db) => db.collection(COLLECTION).doc(id).remove());
}
async function removeForPoint(user, knowledgePointId) {
  // 分批清理确切归属的文档，失败由上层返回，重试可继续处理剩余项。
  while (true) {
    const batch = await request(async (db) =>
      documents(
        await db
          .collection(COLLECTION)
          .where({ user, knowledgePointId })
          .limit(100)
          .get(),
      ),
    );
    if (!batch.length) return;
    for (const record of batch) await remove(record._id);
  }
}
module.exports = {
  documentId,
  findById,
  create,
  recent,
  remove,
  removeForPoint,
};
