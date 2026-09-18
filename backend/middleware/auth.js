// 认证中间件（对应讲义第 3 课）
// 约定：Token 通过请求头 x-auth-token 传递（讲义第 3 课 Postman 演示误用了 Bearer，见 errata.md 第 4 条）

const jwt = require('jsonwebtoken');
const { createResponse } = require('../utils/response');

module.exports = function auth(req, res, next) {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json(createResponse(false, null, '未提供 Token，拒绝访问'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // { id, username }
    next();
  } catch (err) {
    return res.status(401).json(createResponse(false, null, 'Token 无效或已过期'));
  }
};
