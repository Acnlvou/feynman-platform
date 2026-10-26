const { createHash } = require('node:crypto');
const { runDatabaseRequest } = require('../config/cloudbase');
const COLLECTION = 'feynman_quizzes';
async function request(operation) {
  try {
    return await runDatabaseRequest(operation);
  } catch (error) {
    error.collectionName = COLLECTION;
    throw error;
  }
}
const rows = (result) =>
  Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
const documentId = (user, pointId, key) =>
  createHash('sha256')
    .update(JSON.stringify([user, pointId, key]))
    .digest('hex')
    .slice(0, 32);
async function findById(id) {
  return request(async (db) => {
    try {
      return rows(await db.collection(COLLECTION).doc(id).get())[0] || null;
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
    rows(
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
async function acquire(record, stage, token, answer) {
  return request(async (db) => {
    const result = await db
      .collection(COLLECTION)
      .where({
        _id: record._id,
        user: record.user,
        [stage === 'generate' ? 'question' : 'result']:
          db.command.exists(false),
        ...(stage === 'grade'
          ? {
              question: db.command.exists(true),
              answer:
                record.answer === undefined
                  ? db.command.exists(false)
                  : record.answer,
            }
          : {}),
        ...(record.lease
          ? { 'lease.token': record.lease.token }
          : { lease: db.command.exists(false) }),
      })
      .update({
        lease: { stage, token, until: Date.now() + 120000 },
        ...(stage === 'grade'
          ? { answer, submittedAt: record.submittedAt || new Date() }
          : {}),
      });
    return result.updated > 0;
  });
}
async function finish(id, user, stage, token, fields) {
  return request(async (db) => {
    const result = await db
      .collection(COLLECTION)
      .where({
        _id: id,
        user,
        'lease.token': token,
        [stage === 'generate' ? 'question' : 'result']:
          db.command.exists(false),
      })
      .update({
        ...fields,
        lease: db.command.remove(),
        operationError: db.command.remove(),
      });
    return result.updated > 0;
  });
}
async function release(id, user, token, message) {
  return request((db) =>
    db
      .collection(COLLECTION)
      .where({ _id: id, user, 'lease.token': token })
      .update({ lease: db.command.remove(), operationError: message }),
  );
}
async function setReviewOutcome(id, user, status) {
  return request((db) =>
    db
      .collection(COLLECTION)
      .where({ _id: id, user })
      .update({ 'result.reviewStatus': status }),
  );
}
async function removeForPoint(user, knowledgePointId) {
  while (true) {
    const batch = await request(async (db) =>
      rows(
        await db
          .collection(COLLECTION)
          .where({ user, knowledgePointId })
          .limit(100)
          .get(),
      ),
    );
    if (!batch.length) return;
    for (const row of batch)
      await request((db) =>
        db
          .collection(COLLECTION)
          .where({ _id: row._id, user, knowledgePointId })
          .remove(),
      );
  }
}
module.exports = {
  documentId,
  findById,
  create,
  recent,
  acquire,
  finish,
  release,
  setReviewOutcome,
  removeForPoint,
};
