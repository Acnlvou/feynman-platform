const KnowledgePoint = require('../models/KnowledgePoint');
const { createHash } = require('node:crypto');
const FIELDS = ['title', 'content', 'status', 'reviewList', 'category', 'tags'];
const STATUSES = ['not_started', 'in_progress', 'mastered'];
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
  return publicPoint(await KnowledgePoint.create({ user, ...validate(input) }));
}
async function update(point, input) {
  const fields = validate(input, true);
  if (
    input.revision !== undefined &&
    (!Number.isInteger(input.revision) ||
      input.revision !== (point.revision || 1))
  )
    throw failure('内容已在其他页面更新，请重新打开后再保存', 409);
  const changed = Object.keys(fields).some(
    (key) =>
      JSON.stringify(fields[key]) !== JSON.stringify(publicPoint(point)[key]),
  );
  if (!changed) return publicPoint(point);
  const result = await KnowledgePoint.updateById(point, fields);
  if (!result) throw failure('内容已发生变化，请重新加载后再操作', 409);
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
      created.push({ index, point: publicPoint(point) });
    } catch (error) {
      failed.push({ index, message: '该条导入失败，请稍后重试' });
    }
  }
  return { created, failed };
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
};
