const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const knowledge = require('../services/knowledgePoints');
const speech = require('../services/baiduSpeech');
const { createResponse } = require('../utils/response');
const router = express.Router();
const activeUsers = new Set();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 1,
    // Busboy在达到parts上限时发出事件；留一个边界计数，files/fields仍各限1。
    parts: 3,
    fieldSize: 128,
  },
}).single('audio');

router.post('/transcribe', auth, (req, res, next) => {
  const user = req.user.id;
  if (activeUsers.has(user) || activeUsers.size >= 4)
    return res
      .status(429)
      .json(
        createResponse(false, null, '语音识别正忙，请等当前请求完成后重试'),
      );
  activeUsers.add(user);
  const controller = new AbortController();
  let released = false;
  let processing = false;
  const release = () => {
    if (!released) {
      released = true;
      activeUsers.delete(user);
    }
  };
  const disconnected = () => {
    controller.abort();
    if (!processing) release();
  };
  req.once('aborted', disconnected);
  res.once('close', disconnected);
  upload(req, res, async (uploadError) => {
    processing = true;
    try {
      if (controller.signal.aborted) return;
      if (uploadError) {
        const tooLarge = uploadError.code === 'LIMIT_FILE_SIZE';
        throw Object.assign(
          new Error(
            tooLarge
              ? '录音文件不能超过2MB'
              : '音频上传格式不正确，请重新选择录音',
          ),
          { status: tooLarge ? 413 : 400 },
        );
      }
      if (!req.file)
        throw Object.assign(new Error('请先录音，再上传音频'), { status: 400 });
      await knowledge.owned(req.body?.knowledgePointId, user);
      if (controller.signal.aborted) return;
      const result = await speech.transcribe(
        req.file.buffer,
        user,
        controller.signal,
      );
      if (!res.destroyed)
        res.json(createResponse(true, result, '语音转文字成功'));
    } catch (error) {
      if (!res.destroyed) next(error);
    } finally {
      release();
      req.removeListener('aborted', disconnected);
      res.removeListener('close', disconnected);
      // 不将录音落盘或附加到错误日志，处理后解除引用。
      if (req.file) req.file.buffer = null;
    }
  });
});
module.exports = router;
