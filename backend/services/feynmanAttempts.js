const Attempt = require('../models/FeynmanAttempt');
const knowledge = require('./knowledgePoints');
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
function publicAttempt(record) {
  return {
    _id: record._id,
    knowledgePointId: record.knowledgePointId,
    text: record.text,
    duration: record.duration,
    createdAt: record.createdAt,
    hasEvaluation: Boolean(record.evaluation),
  };
}
async function recent(user, id) {
  await knowledge.owned(id, user);
  return (await Attempt.recent(user, id)).map(publicAttempt);
}
async function save(user, id, input) {
  await knowledge.owned(id, user);
  if (
    !input ||
    typeof input.text !== 'string' ||
    !input.text.trim() ||
    input.text.trim().length > 5000
  )
    throw fail('复述文字须为1–5000字符');
  if (
    typeof input.duration !== 'number' ||
    !Number.isFinite(input.duration) ||
    input.duration <= 0 ||
    input.duration > 60
  )
    throw fail('录音时长须大于0且不超过60秒');
  if (
    typeof input.saveKey !== 'string' ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(input.saveKey)
  )
    throw fail('保存标识不正确，请重新打开录音页面');
  const fields = {
    user,
    knowledgePointId: id,
    text: input.text.trim(),
    duration: input.duration,
  };
  const attemptId = Attempt.documentId(user, id, input.saveKey);
  let record = await Attempt.findById(attemptId);
  if (!record) {
    try {
      record = await Attempt.create(attemptId, fields);
    } catch (error) {
      record = await Attempt.findById(attemptId);
      if (!record) throw error;
    }
  }
  if (
    record.user !== user ||
    record.knowledgePointId !== id ||
    record.text !== fields.text ||
    record.duration !== fields.duration
  )
    throw fail('同一次保存标识对应的内容已改变，请重新保存', 409);
  // 防止保存过程中知识点已被删除而留下新的孤立复述。
  try {
    await knowledge.owned(id, user);
  } catch (error) {
    if ([403, 404, 409].includes(error.status)) await Attempt.remove(attemptId);
    throw error;
  }
  return publicAttempt(record);
}
module.exports = { save, recent };
