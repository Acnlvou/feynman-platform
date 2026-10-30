const { test, after, before } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const tables = new Map();
let sequence = 0;
const clone = (value) => structuredClone(value);
const db = {
  command: { exists: (value) => ({ exists: value }) },
  collection(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    const table = tables.get(name);
    const query = (criteria = {}) => {
      let offset = 0,
        limit = Infinity,
        projection = {};
      const matches = (row) =>
        Object.entries(criteria).every(([key, value]) =>
          value && typeof value === 'object' && 'exists' in value
            ? (row[key] !== undefined) === value.exists
            : row[key] === value,
        );
      const q = {
        where: query,
        field: (value) => {
          projection = value;
          return q;
        },
        orderBy: () => q,
        skip: (value) => {
          offset = value;
          return q;
        },
        limit: (value) => {
          limit = value;
          return q;
        },
        get: async () => ({
          data: [...table.values()]
            .filter(matches)
            .slice(offset, offset + limit)
            .map((row) => {
              const result = clone(row);
              for (const key in projection)
                if (!projection[key]) delete result[key];
              return result;
            }),
        }),
        update: async (fields) => {
          let updated = 0;
          for (const row of table.values())
            if (matches(row)) {
              Object.assign(row, clone(fields));
              updated++;
            }
          return { updated };
        },
        remove: async () => {
          let deleted = 0;
          for (const [id, row] of table)
            if (matches(row)) {
              table.delete(id);
              deleted++;
            }
          return { deleted };
        },
      };
      return q;
    };
    return {
      ...query(),
      add: async (data) => {
        const id = data._id || 'record-' + ++sequence;
        if (table.has(id)) throw Error('duplicate');
        table.set(id, clone({ ...data, _id: id }));
        return { id };
      },
      doc: (id) => ({
        get: async () => {
          if (!table.has(id))
            throw Object.assign(Error('missing'), {
              code: 'DOCUMENT_NOT_FOUND',
            });
          return { data: [clone(table.get(id))] };
        },
        remove: async () => ({ deleted: table.delete(id) ? 1 : 0 }),
      }),
    };
  },
};
const config = require.resolve('../config/cloudbase');
require.cache[config] = {
  id: config,
  filename: config,
  loaded: true,
  exports: {
    runDatabaseRequest: (fn) => fn(db),
    hasCloudBaseConfig: () => true,
    checkConnection: async () => ({ data: [] }),
  },
};
process.env.JWT_SECRET = 'lesson6-isolated-test-secret';
process.env.NODE_ENV = 'production';
const embeddings = require.resolve('../services/siliconflowEmbeddings');
require.cache[embeddings] = {
  id: embeddings,
  filename: embeddings,
  loaded: true,
  exports: {
    currentModel: () => 'lesson6-test-embedding-model',
    embedTexts: async (texts) => texts.map(() => [1, 0]),
  },
};
const app = require('../index');
let server, base;
const token = (user) =>
  jwt.sign({ user: { id: user, username: 'Test' } }, process.env.JWT_SECRET);
const headers = (user) => ({
  'content-type': 'application/json',
  ...(user ? { 'x-auth-token': token(user) } : {}),
});
async function request(method, path, body, user = 'owner', status = 200) {
  const r = await fetch(base + '/api/knowledge-points' + path, {
    method,
    headers: headers(user),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await r.json();
  assert.equal(r.status, status, method + ' ' + path + ': ' + json.message);
  return json.data;
}
before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => new Promise((resolve) => server.close(resolve)));
test('第六课 HTTP 功能与数据一致性（隔离数据库）', async (t) => {
  let point;
  const rich = '# Markdown\n\n$E=mc^2$\n\n```mermaid\ngraph LR\nA-->B\n```';
  await t.test('分类、标签、字段白名单及验证', async () => {
    point = await request(
      'POST',
      '/',
      {
        title: '公式测试',
        content: rich,
        category: ' 数学 ',
        tags: ['公式', '公式', '图表'],
        _id: 'injected',
        user: 'someone',
        history: [{}],
      },
      'owner',
      201,
    );
    assert.equal(point.category, '数学');
    assert.deepEqual(point.tags, ['公式', '图表']);
    assert.equal(point.user, 'owner');
    assert.notEqual(point._id, 'injected');
    assert.equal(point.revision, 1);
    assert.equal(point.history, undefined);
    await request(
      'POST',
      '/',
      { title: 'x', content: 'y', tags: ['a'.repeat(21)] },
      'owner',
      400,
    );
    await request(
      'POST',
      '/',
      { title: 'x', content: 'y', category: [] },
      'owner',
      400,
    );
    await request('GET', '/', null, null, 401);
  });
  await t.test('历史、恢复与乐观并发控制', async () => {
    const updated = await request('PUT', '/' + point._id, {
      content: '第二版',
      category: '物理',
      tags: ['能量'],
      revision: 1,
    });
    assert.equal(updated.revision, 2);
    const history = await request('GET', '/' + point._id + '/history');
    assert.equal(history.length, 2);
    assert.equal(history[1].content, rich);
    await request('GET', '/' + point._id + '/history', null, 'other', 403);
    await request(
      'POST',
      '/' + point._id + '/restore',
      { version: 1, revision: 2 },
      'other',
      403,
    );
    const restored = await request('POST', '/' + point._id + '/restore', {
      version: 1,
      revision: 2,
    });
    assert.equal(restored.content, rich);
    assert.equal(restored.category, '数学');
    assert.equal(restored.revision, 3);
    const after = await request('GET', '/' + point._id + '/history');
    assert.equal(after.find((v) => v.version === 2).content, '第二版');
    await request(
      'PUT',
      '/' + point._id,
      { content: 'stale', revision: 2 },
      'owner',
      409,
    );
    const statuses = await Promise.all(
      ['a', 'b'].map((content) =>
        fetch(base + '/api/knowledge-points/' + point._id, {
          method: 'PUT',
          headers: headers('owner'),
          body: JSON.stringify({ content, revision: 3 }),
        }).then((r) => r.status),
      ),
    );
    assert.deepEqual(statuses.sort(), [200, 409]);
  });
  await t.test('JSON 导入导出、隔离所有权及幂等重试', async () => {
    const backup = await request('GET', '/export');
    assert.equal(backup.format, 'feynman-knowledge');
    assert.equal(backup.knowledgePoints[0].user, undefined);
    assert.equal(backup.knowledgePoints[0]._id, undefined);
    assert.equal(backup.knowledgePoints[0].history, undefined);
    const body = {
      ...backup,
      importKeys: backup.knowledgePoints.map(
        (_, i) => 'import-test-00000000-' + i,
      ),
    };
    const first = await request('POST', '/import', body, 'other');
    assert.equal(first.created.length, 1);
    assert.equal(first.created[0].point.user, 'other');
    const second = await request('POST', '/import', body, 'other');
    assert.equal(second.created[0].point._id, first.created[0].point._id);
    assert.equal((await request('GET', '/', null, 'other')).length, 1);
    const bad = {
      ...backup,
      knowledgePoints: [
        backup.knowledgePoints[0],
        { title: 'bad', content: '' },
      ],
    };
    await request('POST', '/import', bad, 'other', 400);
    assert.equal((await request('GET', '/', null, 'other')).length, 1);
    await request('POST', '/import', { ...backup, version: 2 }, 'owner', 400);
  });
  await t.test('旧记录默认字段与首次历史保存', async () => {
    await db
      .collection('knowledge_points')
      .add({
        _id: 'legacy',
        user: 'owner',
        title: '旧笔记',
        content: '旧内容',
        status: 'not_started',
        reviewList: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const legacy = await request('GET', '/legacy');
    assert.equal(legacy.revision, 1);
    assert.equal(legacy.category, '');
    assert.deepEqual(legacy.tags, []);
    const updated = await request('PUT', '/legacy', {
      content: '新内容',
      revision: 1,
    });
    assert.equal(updated.revision, 2);
    const history = await request('GET', '/legacy/history');
    assert.equal(history[1].content, '旧内容');
  });
  await t.test('历史保留上限、版本不存在与删除', async () => {
    let current = await request('GET', '/' + point._id);
    for (let i = 0; i < 14; i++)
      current = await request('PUT', '/' + point._id, {
        content: '更新' + i,
        revision: current.revision,
      });
    assert.equal(
      (await request('GET', '/' + point._id + '/history')).length,
      11,
    );
    await request(
      'POST',
      '/' + point._id + '/restore',
      { version: 1, revision: current.revision },
      'owner',
      404,
    );
    await request('DELETE', '/' + point._id, null, 'other', 403);
    await request('DELETE', '/' + point._id);
    await request('GET', '/' + point._id, null, 'owner', 404);
  });
});
