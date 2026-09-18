// 用户路由：注册 / 登录（对应讲义第 3 课）
// 挂载于 /api/users，故完整路径为 /api/users/register、/api/users/login

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createResponse } = require('../utils/response');

const router = express.Router();

// 签发 JWT（有效期默认 5h，与讲义约定一致）
function signToken(user) {
  return jwt.sign(
    { user: { id: user._id, username: user.username } },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '5h' }
  );
}

// POST /api/users/register —— 注册成功后直接返回 Token（注册即登录）
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json(createResponse(false, null, '用户名、邮箱、密码均为必填'));
    }

    // 用户名与邮箱都要查重（修正讲义第 3 课只查邮箱的问题）
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.username === username ? '用户名' : '邮箱';
      return res.status(400).json(createResponse(false, null, `该${field}已被注册`));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ username, email, password: hashedPassword });

    res.status(201).json(createResponse(true, { token: signToken(user) }, '注册成功'));
  } catch (err) {
    next(err);
  }
});

// POST /api/users/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(createResponse(false, null, '邮箱和密码均为必填'));
    }

    const user = await User.findOne({ email });
    // 用户不存在与密码错误返回同一提示，避免暴露账号是否已注册
    if (!user) {
      return res.status(400).json(createResponse(false, null, '邮箱或密码错误'));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json(createResponse(false, null, '邮箱或密码错误'));
    }

    res.json(createResponse(true, { token: signToken(user) }, '登录成功'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
