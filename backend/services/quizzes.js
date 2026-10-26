const { createHash, randomUUID } = require('node:crypto');
const Quiz = require('../models/FeynmanQuiz');
const User = require('../models/User');
const knowledge = require('./knowledgePoints');
const providers = require('./llmProviders');
const runtime = require('./llmRuntime');
const schema = require('./quizSchemas');
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const fingerprint = (point) =>
  createHash('sha256')
    .update(JSON.stringify([point.title, point.content]))
    .digest('hex');
function source(point) {
  return {
    title: point.title,
    content: point.content,
    revision: point.revision || 1,
    fingerprint: fingerprint(point),
  };
}
async function owned(user, pointId, quizId) {
  const point = await knowledge.owned(pointId, user);
  if (typeof quizId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(quizId))
    throw fail('测评编号不正确');
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw fail('测评记录不存在', 404);
  if (quiz.user !== user || quiz.knowledgePointId !== pointId)
    throw fail('无权访问这条测评', 403);
  return { point, quiz };
}
function status(quiz) {
  if (quiz.result) return 'completed';
  if (quiz.answer !== undefined)
    return quiz.lease?.until > Date.now() ? 'grading' : 'grading_failed';
  if (quiz.question) return 'awaiting_answer';
  return quiz.lease?.until > Date.now() ? 'generating' : 'generation_failed';
}
function summary(quiz) {
  return {
    _id: quiz._id,
    type: quiz.type,
    difficulty: quiz.difficulty,
    title: (quiz.question?.question || quiz.source.title).slice(0, 160),
    createdAt: quiz.createdAt,
    status: status(quiz),
    ...(quiz.result
      ? { score: quiz.result.score, isCorrect: quiz.result.isCorrect }
      : {}),
  };
}
function publicQuiz(point, quiz) {
  return {
    ...summary(quiz),
    knowledgePointId: quiz.knowledgePointId,
    requestKey: quiz.requestKey,
    sourceChanged: fingerprint(point) !== quiz.source.fingerprint,
    sourceTitle: quiz.source.title,
    sourceRevision: quiz.source.revision,
    operationError: quiz.operationError || null,
    generation: quiz.generation || null,
    ...(quiz.question
      ? {
          question: {
            text: quiz.question.question,
            ...(quiz.type === 'single-choice'
              ? { options: quiz.question.options }
              : {}),
          },
        }
      : {}),
    ...(quiz.answer !== undefined
      ? { answer: quiz.answer, submittedAt: quiz.submittedAt }
      : {}),
    ...(quiz.result
      ? {
          result: {
            ...quiz.result,
            ...(quiz.type === 'single-choice'
              ? { correctAnswer: quiz.question.answer }
              : { answerKeyPoints: quiz.question.answerKeyPoints }),
          },
        }
      : {}),
  };
}
async function read(user, pointId, quizId) {
  const { point, quiz } = await owned(user, pointId, quizId);
  return publicQuiz(point, quiz);
}
async function recent(user, pointId) {
  await knowledge.owned(pointId, user);
  return (await Quiz.recent(user, pointId)).map(summary);
}
function configuredProvider() {
  const provider = providers.configured()[0];
  if (!provider)
    throw fail(
      'DeepSeek尚未配置，请在后端填写DEEPSEEK_API_KEY和DEEPSEEK_MODEL',
      503,
    );
  return provider;
}
async function modelCall(user, provider, system, data, validate, signal) {
  const started = Date.now();
  let value,
    failure,
    outcome = 'successes',
    metricsIncomplete = false;
  try {
    value = await providers.completeJson(
      provider,
      system,
      data,
      validate,
      signal,
    );
  } catch (error) {
    failure = error;
    outcome = error.code === 'CANCELLED' ? 'cancelled' : 'failures';
  }
  const durationMs = Date.now() - started;
  try {
    await User.recordLlmMetric(user, provider.id, outcome, durationMs);
  } catch {
    metricsIncomplete = true;
  }
  if (failure) throw failure;
  return {
    value,
    metadata: {
      provider: provider.id,
      providerName: provider.name,
      model: provider.model,
      durationMs,
      metricsIncomplete,
      evaluatedAt: new Date().toISOString(),
    },
  };
}
async function compute(user, quiz, stage, answer, provider, signal) {
  if (stage === 'generate') {
    const output = await modelCall(
      user,
      provider,
      schema.GENERATE,
      {
        title: quiz.source.title,
        reference: quiz.source.content,
        type: quiz.type,
        difficulty: quiz.difficulty,
      },
      (value) => schema.question(value, quiz.type, quiz.difficulty),
      signal,
    );
    return { question: output.value, generation: output.metadata };
  }
  let score, explanation, metadata;
  if (quiz.type === 'single-choice') {
    score = answer === quiz.question.answer ? 100 : 0;
    explanation = quiz.question.explanation;
    metadata = {
      provider: null,
      providerName: '服务端判分',
      model: null,
      durationMs: 0,
      metricsIncomplete: false,
      evaluatedAt: new Date().toISOString(),
    };
  } else {
    const output = await modelCall(
      user,
      provider,
      schema.GRADE,
      {
        reference: quiz.source.content,
        question: quiz.question.question,
        answerKeyPoints: quiz.question.answerKeyPoints,
        studentAnswer: answer,
      },
      schema.grade,
      signal,
    );
    ({ score, explanation } = output.value);
    metadata = output.metadata;
  }
  return {
    result: {
      score,
      isCorrect: score >= 60,
      explanation,
      ...metadata,
      reviewStatus: score < 60 ? 'pending' : 'not_needed',
    },
  };
}
async function runStage(user, pointId, record, stage, signal, answer) {
  const release = runtime.acquire(user);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 90000);
  const key = `quiz:${stage}:${user}:${record._id}`;
  const token = randomUUID();
  let leased = false,
    failureMessage = '任务未完成，可手动重试';
  try {
    for (const [cacheKey, entry] of runtime.pending)
      if (entry.until < Date.now()) runtime.pending.delete(cacheKey);
    if (record.lease?.until > Date.now())
      throw fail('该测评正在处理，请稍后读取或重试', 409);
    const cached = runtime.pending.get(key)?.value;
    const needsModel = stage === 'generate' || record.type === 'short-answer';
    const provider = !cached && needsModel ? configuredProvider() : null;
    if (!cached && runtime.pending.size >= 64)
      throw fail('暂存结果等待保存，请稍后重试', 503);
    if (controller.signal.aborted)
      throw fail('任务已取消或超时，可手动重试', 504);
    if (!cached)
      runtime.pending.set(key, { value: null, until: Date.now() + 600000 });
    leased = await Quiz.acquire(record, stage, token, answer);
    if (!leased) throw fail('测评状态已变化，请重新读取记录', 409);
    const fields =
      cached ||
      (await compute(user, record, stage, answer, provider, controller.signal));
    runtime.pending.set(key, { value: fields, until: Date.now() + 600000 });
    const latest = await owned(user, pointId, record._id);
    const completedField = stage === 'generate' ? 'question' : 'result';
    if (!latest.quiz[completedField]) {
      try {
        const saved = await Quiz.finish(record._id, user, stage, token, fields);
        if (!saved) throw fail('结果保存状态已变化，请重新读取测评', 409);
        leased = false;
      } catch (error) {
        if (error.status === 409) throw error;
        throw fail(
          '结果已生成但数据库保存失败，本进程暂存10分钟，请用同一题目重试补存',
          503,
        );
      }
    }
    const confirmed = await owned(user, pointId, record._id);
    runtime.pending.delete(key);
    return confirmed;
  } catch (error) {
    failureMessage = error.name?.startsWith('CloudBase')
      ? '数据库暂不可用，请稍后重试'
      : error.message;
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    if (leased) {
      try {
        await Quiz.release(record._id, user, token, failureMessage);
      } catch {
        /* 120秒后租约可重新取得；不丢弃内存补存结果。 */
      }
    }
    if (runtime.pending.get(key)?.value === null) runtime.pending.delete(key);
    release();
  }
}
async function review(user, pointId, quiz) {
  const result = quiz.result;
  if (
    result.isCorrect ||
    ['applied', 'not_needed', 'source_changed'].includes(result.reviewStatus)
  )
    return;
  let outcome = 'failed';
  try {
    for (let retry = 0; retry < 2; retry++) {
      const point = await knowledge.owned(pointId, user);
      if (fingerprint(point) !== quiz.source.fingerprint) {
        outcome = 'source_changed';
        break;
      }
      if (point.reviewList) {
        outcome = 'applied';
        break;
      }
      try {
        await knowledge.update(point, {
          reviewList: true,
          revision: point.revision || 1,
        });
        outcome = 'applied';
        break;
      } catch (error) {
        if (error.status !== 409 || retry === 1) throw error;
      }
    }
  } catch {
    outcome = 'failed';
  }
  try {
    await Quiz.setReviewOutcome(quiz._id, user, outcome);
  } catch {
    result.reviewRecordingIncomplete = true;
  }
  result.reviewStatus = outcome;
}
async function generate(user, pointId, input, signal) {
  if (
    !input ||
    !schema.TYPES.includes(input.type) ||
    !schema.DIFFICULTIES.includes(input.difficulty) ||
    typeof input.requestKey !== 'string' ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestKey)
  )
    throw fail('题型、难度或出题标识不正确');
  const point = await knowledge.owned(pointId, user);
  const id = Quiz.documentId(user, pointId, input.requestKey);
  let record = await Quiz.findById(id);
  if (!record) {
    try {
      record = await Quiz.create(id, {
        user,
        knowledgePointId: pointId,
        type: input.type,
        difficulty: input.difficulty,
        requestKey: input.requestKey,
        source: source(point),
      });
    } catch (error) {
      record = await Quiz.findById(id);
      if (!record) throw error;
    }
  }
  const current = await owned(user, pointId, id);
  record = current.quiz;
  if (record.type !== input.type || record.difficulty !== input.difficulty)
    throw fail('同一出题标识不能修改题型或难度，请生成新题', 409);
  if (record.question) return publicQuiz(current.point, record);
  const done = await runStage(user, pointId, record, 'generate', signal);
  return publicQuiz(done.point, done.quiz);
}
async function answer(user, pointId, quizId, input, signal) {
  let current = await owned(user, pointId, quizId);
  const record = current.quiz;
  if (!record.question) throw fail('题目尚未生成，请先完成出题', 409);
  if (typeof input?.answer !== 'string') throw fail('请填写答案');
  const value = input.answer.trim();
  if (
    record.type === 'single-choice'
      ? !['A', 'B', 'C', 'D'].includes(value)
      : !value || value.length > 5000
  )
    throw fail('答案格式不正确或超过5000字符');
  if (record.answer !== undefined && record.answer !== value)
    throw fail('这条测评已提交其他答案，重新作答请生成新题', 409);
  if (!record.result)
    current = await runStage(user, pointId, record, 'grade', signal, value);
  await review(user, pointId, current.quiz);
  const confirmed = await owned(user, pointId, quizId);
  // 使用本次复习操作的告警；数据库读回再次确保记录仍归当前用户。
  confirmed.quiz.result = current.quiz.result;
  return publicQuiz(confirmed.point, confirmed.quiz);
}
module.exports = { generate, answer, read, recent };
