// ============================================================
// 费曼学习平台 · 后端入口
// 对应讲义：《大前端与AI实战》第 1～3 课
//  第 1 课：Express Hello World
//  第 2 课：dotenv / cors / Mongoose 接数据库 / 用户注册
//  第 3 课：JWT 登录、认证中间件、知识点 CRUD
// ============================================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');

const app = express();

// ---------------- 全局中间件 ----------------
app.use(cors()); // 允许前端跨域访问（讲义第 2 课提到但漏装，见 errata.md 第 3 条）
app.use(express.json()); // 解析 JSON 请求体，否则 req.body 为 undefined

// ---------------- 第 1 课：Hello World ----------------
app.get('/', (req, res) => {
  res.send('Hello, Feynman Learner!');
});

// ---------------- 第 3 课：业务路由 ----------------
app.use('/api/users', require('./routes/users'));
app.use('/api/knowledge-points', require('./routes/knowledgePoints'));

// ---------------- 统一错误处理 ----------------
// 必须挂在所有路由之后：先兜住 404，再统一处理异常
app.use(errorHandler.notFound);
app.use(errorHandler);

// ---------------- 启动自检 ----------------
if (!process.env.JWT_SECRET) {
  console.warn('[警告] 未检测到 JWT_SECRET，注册/登录签发的 Token 将无法验证。');
  console.warn('       请复制 .env.example 为 .env 并填写 JWT_SECRET。');
}

// ---------------- 数据库连接 ----------------
// 未连接数据库时让操作快速失败，而不是无限挂起
mongoose.set('bufferCommands', false);

if (!process.env.MONGO_URI) {
  console.warn('[警告] 未检测到 MONGO_URI，所有数据库相关接口将不可用。');
  console.warn('       请复制 .env.example 为 .env 并填写 Atlas 连接串。');
} else {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log(`[数据库] MongoDB 连接成功：${mongoose.connection.host}`))
    .catch((err) => {
      // 故意不 process.exit：无数据库时服务照常启动，便于本地调试其它功能
      console.error('[数据库] MongoDB 连接失败（服务仍继续运行）：', err.message);
    });
}

// ---------------- 启动服务 ----------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[服务] 费曼学习平台后端已启动：http://localhost:${PORT}`);
});

module.exports = app;
