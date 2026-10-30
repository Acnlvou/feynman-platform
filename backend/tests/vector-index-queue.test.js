const { test } = require('node:test');
const assert = require('node:assert/strict');
const KnowledgePoint = require('../models/KnowledgePoint');
const vectorStore = require('../services/vectorStoreService');
const service = require('../services/knowledgePoints');

test('marks the index failed when the worker first CloudBase read rejects', async () => {
  const originalFindById = KnowledgePoint.findById;
  const originalSetVectorIndexState = KnowledgePoint.setVectorIndexState;
  const originalIsIndexCurrent = vectorStore.isIndexCurrent;
  const point = {
    _id: 'vector-index-worker-test',
    user: 'vector-index-worker-test-user',
    revision: 3,
    contentRevision: 2,
    deleting: false,
  };
  const states = [];
  let reads = 0;

  try {
    KnowledgePoint.findById = async () => {
      reads += 1;
      if (reads === 2) {
        throw Object.assign(new Error('transient read failure'), {
          code: 'CLOUD_BASE_REQUEST_FAILED',
        });
      }
      return point;
    };
    KnowledgePoint.setVectorIndexState = async (_id, _user, _revision, state) => {
      states.push(state);
      return true;
    };
    vectorStore.isIndexCurrent = async () => false;

    const result = await service.reindexPoint(point._id, point.user);
    assert.equal(result.status, 'pending');

    const deadline = Date.now() + 2000;
    while (!states.some((state) => state.status === 'failed') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.ok(states.some((state) => state.status === 'failed'));
    assert.equal(
      states.find((state) => state.status === 'failed').errorCode,
      'CLOUD_BASE_REQUEST_FAILED',
    );
  } finally {
    KnowledgePoint.findById = originalFindById;
    KnowledgePoint.setVectorIndexState = originalSetVectorIndexState;
    vectorStore.isIndexCurrent = originalIsIndexCurrent;
  }
});

test('builds the index when CloudBase reports an unchanged pending state', async () => {
  const originalFindById = KnowledgePoint.findById;
  const originalSetVectorIndexState = KnowledgePoint.setVectorIndexState;
  const originalIsIndexCurrent = vectorStore.isIndexCurrent;
  const originalIndexKnowledgePoint = vectorStore.indexKnowledgePoint;
  const point = {
    _id: 'vector-index-unchanged-test',
    user: 'vector-index-unchanged-test-user',
    revision: 4,
    contentRevision: 3,
    vectorIndexStatus: 'pending',
    deleting: false,
  };
  const states = [];
  let buildCount = 0;

  try {
    KnowledgePoint.findById = async () => point;
    KnowledgePoint.setVectorIndexState = async (_id, _user, _revision, state) => {
      states.push(state);
      return state.status === 'ready';
    };
    vectorStore.isIndexCurrent = async () => false;
    vectorStore.indexKnowledgePoint = async () => {
      buildCount += 1;
      return { status: 'ready', revision: point.contentRevision, model: 'test-model' };
    };

    const result = await service.reindexPoint(point._id, point.user);
    assert.equal(result.status, 'pending');

    const deadline = Date.now() + 2000;
    while (!states.some((state) => state.status === 'ready') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.equal(buildCount, 1);
    assert.ok(states.some((state) => state.status === 'ready'));
  } finally {
    KnowledgePoint.findById = originalFindById;
    KnowledgePoint.setVectorIndexState = originalSetVectorIndexState;
    vectorStore.isIndexCurrent = originalIsIndexCurrent;
    vectorStore.indexKnowledgePoint = originalIndexKnowledgePoint;
  }
});
