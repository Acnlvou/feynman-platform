// 知识点路由：完整 CRUD（对应讲义第 3 课）
// 挂载于 /api/knowledge-points，本模块所有接口都需要先登录

const express = require('express');
const KnowledgePoint = require('../models/KnowledgePoint');
const auth = require('../middleware/auth');
const { createResponse } = require('../utils/response');

const router = express.Router();

// 本模块全部接口都经过认证中间件
router.use(auth);

// 公共逻辑：按 id 取知识点并校验归属，失败时直接响应并返回 null
async function findOwned(req, res) {
  const { id } = req.params;

  if (!id || id.length > 128) {
    res.status(400).json(createResponse(false, null, '知识点 ID 格式不正确'));
    return null;
  }

  const kp = await KnowledgePoint.findById(id);
  if (!kp) {
    res.status(404).json(createResponse(false, null, '知识点不存在'));
    return null;
  }

  // 只能操作自己的知识点
  if (String(kp.user) !== String(req.user.id)) {
    res.status(403).json(createResponse(false, null, '无权操作他人的知识点'));
    return null;
  }

  return kp;
}

// POST /api/knowledge-points —— 创建
router.post('/', async (req, res, next) => {
  try {
    const { status, reviewList } = req.body;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content : '';

    if (!title || !content) {
      return res.status(400).json(createResponse(false, null, '标题和内容均为必填'));
    }

    if (status !== undefined && !['not_started', 'in_progress', 'mastered'].includes(status)) {
      return res.status(400).json(createResponse(false, null, '知识点状态不正确'));
    }
    if (reviewList !== undefined && typeof reviewList !== 'boolean') {
      return res.status(400).json(createResponse(false, null, '复习列表标记必须为布尔值'));
    }

    const kp = await KnowledgePoint.create({
      user: req.user.id,
      title,
      content,
      status,
      reviewList,
    });

    res.status(201).json(createResponse(true, kp, '知识点创建成功'));
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-points —— 查询当前用户的全部知识点
router.get('/', async (req, res, next) => {
  try {
    const list = await KnowledgePoint.findByUser(req.user.id);
    res.json(createResponse(true, list, '查询成功'));
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-points/:id —— 查询单个（讲义中留白，本次补全）
router.get('/:id', async (req, res, next) => {
  try {
    const kp = await findOwned(req, res);
    if (!kp) return;
    res.json(createResponse(true, kp, '查询成功'));
  } catch (err) {
    next(err);
  }
});

// PUT /api/knowledge-points/:id —— 更新
router.put('/:id', async (req, res, next) => {
  try {
    const kp = await findOwned(req, res);
    if (!kp) return;

    const { status, reviewList } = req.body;
    const updates = {};

    if (req.body.title !== undefined) {
      if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
        return res.status(400).json(createResponse(false, null, '标题不能为空'));
      }
      updates.title = req.body.title.trim();
    }
    if (req.body.content !== undefined) {
      if (typeof req.body.content !== 'string' || !req.body.content) {
        return res.status(400).json(createResponse(false, null, '内容不能为空'));
      }
      updates.content = req.body.content;
    }
    if (status !== undefined) {
      if (!['not_started', 'in_progress', 'mastered'].includes(status)) {
        return res.status(400).json(createResponse(false, null, '知识点状态不正确'));
      }
      updates.status = status;
    }
    if (reviewList !== undefined) {
      if (typeof reviewList !== 'boolean') {
        return res.status(400).json(createResponse(false, null, '复习列表标记必须为布尔值'));
      }
      updates.reviewList = reviewList;
    }

    const updated = await KnowledgePoint.updateById(kp._id, updates);
    if (!updated) {
      return res.status(404).json(createResponse(false, null, '知识点不存在'));
    }
    res.json(createResponse(true, updated, '知识点更新成功'));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/knowledge-points/:id —— 删除
router.delete('/:id', async (req, res, next) => {
  try {
    const kp = await findOwned(req, res);
    if (!kp) return;

    await KnowledgePoint.deleteById(kp._id);
    res.json(createResponse(true, null, '知识点删除成功'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
