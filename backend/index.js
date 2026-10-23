// ============================================================
// 费曼学习平台 · 后端入口
// 对应讲义：《大前端与AI实战》第 1～3 课
//  第 1 课：Express Hello World
//  第 2 课：dotenv / cors / CloudBase SDK 数据库访问 / 用户注册
//  第 3 课：JWT 登录、认证中间件、知识点 CRUD
// ============================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

const errorHandler = require('./middleware/errorHandler');
const { checkConnection, hasCloudBaseConfig } = require('./config/cloudbase');

const app = express();

// ---------------- 全局中间件 ----------------
app.use(cors()); // 允许前端跨域访问（讲义第 2 课提到但漏装，见 errata.md 第 3 条）
app.use(express.json({ limit: '1mb' })); // 解析 JSON 请求体，否则 req.body 为 undefined

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

// ---------------- 启动服务 ----------------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`[服务] 费曼学习平台后端已启动：http://localhost:${PORT}`);

    if (!hasCloudBaseConfig()) {
      console.warn('[警告] 未检测到 CLOUDBASE_ENV_ID 或 CLOUDBASE_APIKEY，数据库接口暂不可用。');
      return;
    }

    checkConnection()
      .then(() => console.log('[数据库] CloudBase 文档数据库连接成功。'))
      .catch((err) => {
        console.error(`[数据库] CloudBase 连接失败：${err.code || err.name}${err.requestId ? ` (requestId: ${err.requestId})` : ''}`);
      });
  });
}

module.exports = app;
