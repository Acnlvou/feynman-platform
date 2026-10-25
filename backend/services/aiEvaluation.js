const { createHash, randomUUID } = require('node:crypto');
const Attempt = require('../models/FeynmanAttempt');
const User = require('../models/User');
const knowledge = require('./knowledgePoints');
const providers = require('./llmProviders');
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const activeUsers = new Set();
// 只暂存未写入数据库的结果，避免数据库瞬时失败后同进程重试再次付费调用。
const pendingWrites = new Map();
const fingerprint = (point) =>
  createHash('sha256')
    .update(JSON.stringify([point.title, point.content]))
    .digest('hex');
async function owned(user, pointId, attemptId) {
  const point = await knowledge.owned(pointId, user);
  if (
    typeof attemptId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(attemptId)
  )
    throw fail('复述编号不正确');
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) throw fail('复述不存在', 404);
  if (attempt.user !== user || attempt.knowledgePointId !== pointId)
    throw fail('无权访问这条复述', 403);
  return { point, attempt };
}
function result(point, attempt) {
  return {
    attemptId: attempt._id,
    originalText: attempt.text,
    evaluation: attempt.evaluation,
    sourceChanged: fingerprint(point) !== attempt.evaluation.source.fingerprint,
  };
}
async function read(user, pointId, attemptId) {
  const { point, attempt } = await owned(user, pointId, attemptId);
  if (!attempt.evaluation) throw fail('这条复述尚未完成AI评价', 404);
  return result(point, attempt);
}
async function review(user, pointId, attempt) {
  const evaluation = attempt.evaluation;
  if (
    evaluation.score >= 60 ||
    ['applied', 'not_needed', 'source_changed'].includes(
      evaluation.reviewStatus,
    )
  )
    return;
  let status = 'failed';
  try {
    for (let retry = 0; retry < 2; retry++) {
      const point = await knowledge.owned(pointId, user);
      if (fingerprint(point) !== evaluation.source.fingerprint) {
        status = 'source_changed';
        break;
      }
      if (point.reviewList) {
        status = 'applied';
        break;
      }
      try {
        await knowledge.update(point, {
          reviewList: true,
          revision: point.revision || 1,
        });
        status = 'applied';
        break;
      } catch (error) {
        if (error.status !== 409 || retry === 1) throw error;
      }
    }
  } catch {
    status = 'failed';
  }
  try {
    await Attempt.setReviewOutcome(attempt._id, user, status);
  } catch {
    if (status !== 'applied') status = 'failed';
  }
  evaluation.reviewStatus = status;
}
async function evaluate(user, pointId, attemptId, signal) {
  const initial = await owned(user, pointId, attemptId);
  if (activeUsers.has(user) || activeUsers.size >= 4)
    throw fail('AI评价正忙，请等待当前评价完成', 429);
  activeUsers.add(user);
  let token;
  let leased = false;
  const cacheKey = `${user}:${attemptId}`;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 90000);
  try {
    if (initial.attempt.evaluation) {
      await review(user, pointId, initial.attempt);
      return result(
        (await owned(user, pointId, attemptId)).point,
        initial.attempt,
      );
    }
    for (const [key, entry] of pendingWrites)
      if (entry.until < Date.now()) pendingWrites.delete(key);
    if (initial.attempt.evaluationLease?.until > Date.now())
      throw fail('该复述正在评价，请稍后重试', 409);
    const cached = pendingWrites.get(cacheKey);
    const enabled = providers.configured();
    if (!cached && !enabled.length)
      throw fail(
        'DeepSeek尚未配置，请在后端填写DEEPSEEK_API_KEY和DEEPSEEK_MODEL',
        503,
      );
    if (!cached && pendingWrites.size >= 64)
      throw fail('暂存结果等待保存，请稍后重试', 503);
    token = randomUUID();
    leased = await Attempt.acquireEvaluation(initial.attempt, token);
    if (!leased) throw fail('评价状态已变化，请重新打开评价', 409);
    if (!cached)
      pendingWrites.set(cacheKey, {
        evaluation: null,
        until: Date.now() + 600000,
      });
    let evaluation = cached?.evaluation;
    if (!evaluation) {
      const source = {
        title: initial.point.title,
        content: initial.point.content,
        revision: initial.point.revision || 1,
        fingerprint: fingerprint(initial.point),
      };
      let metricsIncomplete = false;
      const trace = [];
      let output;
      for (const provider of enabled) {
        if (controller.signal.aborted)
          throw fail('评价已取消或超时，可手动重试', 504);
        const started = Date.now();
        let outcome = 'failures',
          code = null,
          fatal = false,
          value;
        try {
          value = await providers.call(
            provider,
            source,
            initial.attempt.text,
            controller.signal,
          );
          outcome = 'successes';
        } catch (error) {
          code = error.code || 'SERVICE_ERROR';
          fatal = code === 'CONTENT_REFUSED' || code === 'CANCELLED';
          if (code === 'CANCELLED') outcome = 'cancelled';
        }
        const durationMs = Date.now() - started;
        trace.push({
          provider: provider.id,
          model: provider.model,
          durationMs,
          outcome,
          code,
        });
        try {
          await User.recordLlmMetric(user, provider.id, outcome, durationMs);
        } catch {
          metricsIncomplete = true;
        }
        if (value) {
          output = {
            ...value,
            provider: provider.id,
            providerName: provider.name,
            model: provider.model,
            durationMs,
          };
          break;
        }
        if (fatal)
          throw fail(
            code === 'CONTENT_REFUSED'
              ? '内容被服务方安全策略拒绝，请修改复述后再试'
              : '评价已取消或超时，可手动重试',
            code === 'CONTENT_REFUSED' ? 422 : 504,
          );
      }
      if (!output)
        throw fail(
          'DeepSeek未返回有效评价，请检查凭据、模型及额度后手动重试',
          503,
        );
      evaluation = {
        ...output,
        source,
        evaluatedAt: new Date().toISOString(),
        providerAttempts: trace,
        metricsIncomplete,
        reviewStatus: output.score < 60 ? 'pending' : 'not_needed',
      };
      pendingWrites.set(cacheKey, { evaluation, until: Date.now() + 600000 });
    }
    const latest = await owned(user, pointId, attemptId);
    if (latest.attempt.evaluation) {
      evaluation = latest.attempt.evaluation;
    } else {
      try {
        const saved = await Attempt.finishEvaluation(
          attemptId,
          user,
          token,
          evaluation,
        );
        if (!saved) throw fail('评价保存状态已变化，请重新打开评价', 409);
        leased = false;
      } catch (error) {
        if (error.status === 409) throw error;
        throw fail(
          '评价已生成但数据库保存失败，结果在本进程暂存10分钟，请点击重试保存',
          503,
        );
      }
    }
    pendingWrites.delete(cacheKey);
    const confirmed = await owned(user, pointId, attemptId);
    // 复述或知识点并发删除时不返回私人评价结果。
    confirmed.attempt.evaluation = evaluation;
    await review(user, pointId, confirmed.attempt);
    return result(confirmed.point, confirmed.attempt);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    if (leased) {
      try {
        await Attempt.releaseEvaluation(attemptId, user, token);
      } catch {
        /* 租约120秒后可重试 */
      }
    }
    if (pendingWrites.get(cacheKey)?.evaluation === null)
      pendingWrites.delete(cacheKey);
    activeUsers.delete(user);
  }
}
async function metrics(user) {
  const values = await User.llmMetrics(user);
  const enabled = new Set(
    providers.configured().map((provider) => provider.id),
  );
  return providers.PROVIDERS.map((provider) => {
    const row = values[provider.id] || {};
    const successes = row.successes || 0,
      failures = row.failures || 0,
      completed = successes + failures;
    return {
      provider: provider.id,
      name: provider.name,
      configured: enabled.has(provider.id),
      calls: row.calls || 0,
      successes,
      failures,
      cancelled: row.cancelled || 0,
      successRate: completed ? successes / completed : null,
      averageDurationMs: completed ? (row.durationMs || 0) / completed : null,
    };
  });
}
module.exports = { evaluate, read, metrics };
