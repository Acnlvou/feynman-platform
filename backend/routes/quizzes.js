const express = require('express');
const service = require('../services/quizzes');
const { createResponse } = require('../utils/response');
// 由knowledgePoints路由统一认证，mergeParams保留知识点id。
const router = express.Router({ mergeParams: true });
const endpoint = (operation, message) => async (req, res, next) => {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  req.once('aborted', cancel);
  res.once('close', cancel);
  try {
    const data = await operation(req, controller.signal);
    if (!res.destroyed) res.json(createResponse(true, data, message));
  } catch (error) {
    if (!res.destroyed) next(error);
  } finally {
    req.removeListener('aborted', cancel);
    res.removeListener('close', cancel);
  }
};
router.post(
  '/',
  endpoint(
    (req, signal) =>
      service.generate(req.user.id, req.params.id, req.body, signal),
    '题目已保存',
  ),
);
router.get(
  '/',
  endpoint((req) => service.recent(req.user.id, req.params.id), '最近测评'),
);
router.get(
  '/:quizId',
  endpoint(
    (req) => service.read(req.user.id, req.params.id, req.params.quizId),
    '测评记录',
  ),
);
router.post(
  '/:quizId/answer',
  endpoint(
    (req, signal) =>
      service.answer(
        req.user.id,
        req.params.id,
        req.params.quizId,
        req.body,
        signal,
      ),
    '测评结果已保存',
  ),
);
module.exports = router;
