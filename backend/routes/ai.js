const express = require('express');
const auth = require('../middleware/auth');
const service = require('../services/aiEvaluation');
const { createResponse } = require('../utils/response');
const router = express.Router();
router.get('/metrics', auth, async (req, res, next) => {
  try {
    res.json(
      createResponse(true, await service.metrics(req.user.id), 'AI服务记录'),
    );
  } catch (error) {
    next(error);
  }
});
module.exports = router;
