const { runDatabaseRequest } = require('../config/cloudbase');

const COLLECTION = 'users';

function documentsFrom(result) {
  if (Array.isArray(result.data)) return result.data;
  return result.data ? [result.data] : [];
}

async function findOne(criteria) {
  return runDatabaseRequest(async (db) => {
    const result = await db.collection(COLLECTION).where(criteria).limit(1).get();
    return documentsFrom(result)[0] || null;
  });
}

async function create({ username, email, password }) {
  return runDatabaseRequest(async (db) => {
    const now = new Date();
    const user = { username, email, password, createdAt: now, updatedAt: now };
    const result = await db.collection(COLLECTION).add(user);
    return { ...user, _id: result.id };
  });
}

async function deleteById(id) {
  return runDatabaseRequest((db) => db.collection(COLLECTION).doc(id).remove());
}

module.exports = { create, deleteById, findOne };
