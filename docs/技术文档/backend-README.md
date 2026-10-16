# 费曼学习平台 · 后端

> Web 框架：**Express 4**；运行时：**Node.js**；数据库：腾讯云 **CloudBase 文档数据库**，通过 CloudBase 服务端 SDK 访问。

《大前端与AI实战》实训课第 1–3 课的实战产物：一个基于 Node.js + Express 的后端服务，提供用户注册/登录（JWT 认证）与知识点 CRUD 能力。课程讲义仍按 Mongoose/Atlas 教学；为使用当前腾讯云数据库环境，工程数据库适配层改为 CloudBase SDK，HTTP 接口保持不变。

## 环境要求

- Node.js 18 LTS 及以上（推荐 20 / 22）
- 腾讯云 CloudBase 环境，以及该环境的服务端 API Key
- 可选：Postman 或 curl 用于接口测试

## 快速开始

```bash
# 从仓库根目录进入后端工程
cd backend

# 1. 安装依赖
npm install

# 2. 配置环境变量：复制示例文件后填入自己的真实值
cp .env.example .env

# 3. 编辑 .env，填好 CLOUDBASE_ENV_ID、CLOUDBASE_APIKEY 和 JWT_SECRET

# 4. 启动
npm start        # 生产模式
npm run dev      # 开发模式（nodemon 自动重启）
```

启动成功后终端会打印：

```
[服务] 费曼学习平台后端已启动：http://localhost:3000
[数据库] CloudBase 文档数据库连接成功。
```

浏览器打开 <http://localhost:3000/> 应看到 `Hello, Feynman Learner!`。

首次使用前，在 CloudBase 文档数据库中创建 `users` 与 `knowledge_points` 两个集合。若 CloudBase 配置缺失或连接失败，服务依然会启动；数据库接口会返回 503，根路由仍可用于本地调试。

## 环境变量

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `PORT` | 服务端口 | `3000` |
| `CLOUDBASE_ENV_ID` | CloudBase 环境 ID | `feynman-dev-d9gql03np7c2db9c2` |
| `CLOUDBASE_REGION` | 环境地域 | `ap-shanghai` |
| `CLOUDBASE_APIKEY` | CloudBase 服务端 API Key；只存后端 `.env`，绝不能放入前端或提交到仓库 | 仅本地配置 |
| `JWT_SECRET` | JWT 签名密钥，请用足够长的随机串 | `a_very_long_random_string` |
| `JWT_EXPIRE` | JWT 有效期 | `5h` |

`.env` 已被 `.gitignore` 忽略，**不会**进入版本库，也**不会**被打进分发压缩包。对外只提供 `.env.example`。

配置文件固定读取 `backend/.env`，从仓库根目录或后端目录启动均可。复制服务端 API Key 时请使用控制台的「复制 key」按钮，保证整串凭据完整；不要从截断的页面文本中手动选取。

## 目录结构

```
backend/
├─ index.js                  # 服务入口：中间件、路由挂载、数据库连接
├─ config/
│   └─ cloudbase.js          # CloudBase 初始化、连接检查和数据库错误处理
├─ models/
│   ├─ User.js               # 用户模型
│   └─ KnowledgePoint.js     # 知识点模型
├─ routes/
│   ├─ users.js              # 注册 / 登录
│   └─ knowledgePoints.js    # 知识点 CRUD
├─ middleware/
│   ├─ auth.js               # 认证中间件（x-auth-token）
│   └─ errorHandler.js       # 统一错误处理 + 404
├─ utils/
│   └─ response.js           # 统一响应格式
└─ .env.example              # 环境变量示例
```

## 接口清单

### 用户模块 `/api/users`

| 方法 | 路径 | 说明 | 需要认证 |
| --- | --- | --- | --- |
| POST | `/api/users/register` | 注册，成功直接返回 Token | 否 |
| POST | `/api/users/login` | 登录，返回 Token | 否 |

### 知识点模块 `/api/knowledge-points`

| 方法 | 路径 | 说明 | 需要认证 |
| --- | --- | --- | --- |
| POST | `/api/knowledge-points` | 创建知识点 | 是 |
| GET | `/api/knowledge-points` | 查询当前用户全部知识点 | 是 |
| GET | `/api/knowledge-points/:id` | 查询单个知识点 | 是 |
| PUT | `/api/knowledge-points/:id` | 更新知识点 | 是 |
| DELETE | `/api/knowledge-points/:id` | 删除知识点 | 是 |

认证方式：请求头携带 `x-auth-token: <你的 Token>`。

## 统一响应格式

成功：

```json
{ "success": true, "data": { }, "message": "操作成功", "error": null }
```

失败：

```json
{ "success": false, "data": null, "message": "错误说明", "error": "原始错误信息" }
```

## 测试示例

```bash
# 注册
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"feynman","email":"feynman@example.com","password":"123456"}'

# 登录
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"feynman@example.com","password":"123456"}'

# 创建知识点（把 <TOKEN> 换成上一步返回的 token）
curl -X POST http://localhost:3000/api/knowledge-points \
  -H "Content-Type: application/json" \
  -H "x-auth-token: <TOKEN>" \
  -d '{"title":"HTTP 无状态","content":"每次请求相互独立，服务端不保存会话状态"}'

# 查询列表
curl http://localhost:3000/api/knowledge-points -H "x-auth-token: <TOKEN>"
```

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 终端提示 CloudBase 连接失败 | 检查环境 ID、地域、服务端 API Key 是否匹配，并确认两个集合已创建 |
| 接口返回 503「CloudBase 数据库暂不可用」 | 检查 `.env` 的 CloudBase 配置及 API Key 是否过期；服务本身仍可启动 |
| `req.body` 取不到值 | 确认 `app.use(express.json())` 在路由之前挂载 |
| 接口返回 401 | 请求头缺少 `x-auth-token`，或 Token 已过期（默认 5 小时） |
| 接口返回 403 | 试图操作别人的知识点 |
| 启动报 `EADDRINUSE` | 端口被占用，改 `.env` 里的 `PORT` 或结束占用进程 |

## 相关文档

- [`backend-errata.md`](backend-errata.md) —— 讲义勘误说明（本工程相对讲义的 10 处修正）
- [`../项目计划/`](../项目计划/) —— 项目规划文档
- [`../项目计划/00 费曼学习平台·全项目执行计划.md`](../项目计划/00%20费曼学习平台·全项目执行计划.md) —— 全项目路线图
