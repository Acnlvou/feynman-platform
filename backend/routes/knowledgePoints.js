const express = require('express');
const KnowledgePoint = require('../models/KnowledgePoint');
const service = require('../services/knowledgePoints');
const attempts = require('../services/feynmanAttempts');
const evaluation = require('../services/aiEvaluation');
const Attempt = require('../models/FeynmanAttempt');
const Quiz = require('../models/FeynmanQuiz');
const auth = require('../middleware/auth');
const { createResponse } = require('../utils/response');
const router = express.Router();
router.use(auth);
router.use('/:id/quizzes', require('./quizzes'));
const endpoint = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};
const respond = (res, data, message = '操作成功', status = 200) =>
  res.status(status).json(createResponse(true, data, message));
router.get(
  '/export',
  endpoint(async (req, res) => {
    const list = await KnowledgePoint.findByUser(req.user.id);
    respond(res, {
      format: 'feynman-knowledge',
      version: 1,
      exportedAt: new Date().toISOString(),
      knowledgePoints: list.map(service.exportFields),
    });
  }),
);
router.post(
  '/import',
  endpoint(async (req, res) => {
    respond(
      res,
      await service.importPoints(req.user.id, req.body),
      '导入处理完成',
    );
  }),
);
router.post(
  '/',
  endpoint(async (req, res) =>
    respond(
      res,
      await service.create(req.user.id, req.body),
      '知识点创建成功',
      201,
    ),
  ),
);
router.get(
  '/',
  endpoint(async (req, res) =>
    respond(
      res,
      (await KnowledgePoint.findByUser(req.user.id)).map(service.publicPoint),
      '查询成功',
    ),
  ),
);
router.get(
  '/:id/attempts/:attemptId/evaluation',
  endpoint(async (req, res) =>
    respond(
      res,
      await evaluation.read(req.user.id, req.params.id, req.params.attemptId),
      'AI评价',
    ),
  ),
);
router.post(
  '/:id/attempts/:attemptId/evaluate',
  endpoint(async (req, res) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    req.once('aborted', cancel);
    res.once('close', cancel);
    try {
      const data = await evaluation.evaluate(
        req.user.id,
        req.params.id,
        req.params.attemptId,
        controller.signal,
      );
      if (!res.destroyed) respond(res, data, 'AI评价已保存');
    } finally {
      req.removeListener('aborted', cancel);
      res.removeListener('close', cancel);
    }
  }),
);
router.get(
  '/:id/attempts',
  endpoint(async (req, res) =>
    respond(res, await attempts.recent(req.user.id, req.params.id), '最近复述'),
  ),
);
router.post(
  '/:id/attempts',
  endpoint(async (req, res) =>
    respond(
      res,
      await attempts.save(req.user.id, req.params.id, req.body),
      '复述已保存',
      201,
    ),
  ),
);
router.get(
  '/:id/history',
  endpoint(async (req, res) =>
    respond(
      res,
      service.history(await service.owned(req.params.id, req.user.id)),
      '历史版本',
    ),
  ),
);
router.post(
  '/:id/restore',
  endpoint(async (req, res) => {
    const point = await service.owned(req.params.id, req.user.id);
    respond(
      res,
      await service.restore(point, req.body.version, req.body.revision),
      '已恢复为新版本',
    );
  }),
);
router.get(
  '/:id',
  endpoint(async (req, res) =>
    respond(
      res,
      service.publicPoint(await service.owned(req.params.id, req.user.id)),
      '查询成功',
    ),
  ),
);
router.put(
  '/:id',
  endpoint(async (req, res) =>
    respond(
      res,
      await service.update(
        await service.owned(req.params.id, req.user.id),
        req.body,
      ),
      '知识点更新成功',
    ),
  ),
);
router.delete(
  '/:id',
  endpoint(async (req, res) => {
    const point = await service.owned(req.params.id, req.user.id, {
      allowDeleting: true,
    });
    await KnowledgePoint.markDeleting(point);
    await Quiz.removeForPoint(req.user.id, point._id);
    await Attempt.removeForPoint(req.user.id, point._id);
    await KnowledgePoint.deleteById(point._id);
    respond(res, null, '知识点删除成功');
  }),
);
module.exports = router;
