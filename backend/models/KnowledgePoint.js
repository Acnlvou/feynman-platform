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

async function create({ user, title, content, status = 'not_started', reviewList = false }) {
  return runDatabaseRequest(async (db) => {
    const now = new Date();
    const knowledgePoint = {
      user,
      title,
      content,
      status,
      reviewList,
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

async function updateById(id, fields) {
  return runDatabaseRequest(async (db) => {
    const result = await db
      .collection(COLLECTION)
      .doc(id)
      .update({ ...fields, updatedAt: new Date() });

    if (result.updated === 0) return null;

    return readDocument(db, id);
  });
}

async function deleteById(id) {
  return runDatabaseRequest((db) => db.collection(COLLECTION).doc(id).remove());
}

module.exports = { create, deleteById, findById, findByUser, updateById };
