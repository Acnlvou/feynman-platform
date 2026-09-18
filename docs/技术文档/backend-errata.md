# 讲义勘误说明

> 本文档位于 `docs/技术文档/`；后端工程位于 `backend/`，课程讲义、计划文档和变更记录分别位于 `docs/课程讲义/`、`docs/项目计划/` 和 `docs/变更记录/`。

本文档记录「费曼学习平台后端」实际实现时，对《大前端与AI实战》第 1–3 课讲义所做的修正。

**修正原则**：以第 3 课为准，修正到「能跑通」，同时尽量保留讲义原有的写法与命名风格，方便学生对照学习。

共 10 处。

---

## 1. User 模型字段名冲突：`username` vs `name`（致命）

- **位置**：第 2 课 `models/User.js` 定义的是 `username`；第 3 课 `routes/users.js` 注册时却从请求体解构 `name`。
- **后果**：按讲义原样写，注册时 `username` 为 `undefined`，触发 Mongoose 必填校验失败，注册接口直接 500。
- **本次改法**：统一使用 `username`。
- **建议讲义修改**：把第 3 课 `const { name, email, password } = req.body;` 改为 `const { username, email, password } = req.body;`。

## 2. 注册接口路径不一致

- **位置**：第 2 课写 `POST /api/register`；第 3 课改为 `POST /api/users/register`。
- **后果**：学生按第 2 课测试通过，到第 3 课接口 404。
- **本次改法**：统一为 `/api/users/register`、`/api/users/login`（用户模块统一挂在 `/api/users` 下）。
- **建议讲义修改**：第 2 课的路径与 curl 示例一并更新。

## 3. `cors` 被 require 却从未安装

- **位置**：第 2 课 `index.js` 里 `const cors = require('cors')` 并 `app.use(cors())`，但安装命令中没有 `cors`。
- **后果**：`Error: Cannot find module 'cors'`，服务启动失败。
- **本次改法**：加入 `cors` 依赖并安装。
- **建议讲义修改**：第 2 课安装命令补上 `cors`。

## 4. 认证请求头不一致：`x-auth-token` vs Bearer Token

- **位置**：第 3 课 `middleware/auth.js` 读的是 `req.header('x-auth-token')`；但同课 Postman 演示用的是 Authorization 头（Bearer Token）。
- **后果**：按 Postman 截图操作一定 401。
- **本次改法**：以中间件代码为准，统一使用请求头 `x-auth-token`。
- **建议讲义修改**：更新 Postman 演示步骤，改为自定义请求头 `x-auth-token`。

## 5. `bcryptjs` 重复安装

- **位置**：第 2 课与第 3 课的安装命令都包含 `bcryptjs`。
- **后果**：无功能影响，仅冗余，但会让学生误以为需要装两次或版本不同。
- **本次改法**：只安装一次，写入 `package.json` 的 dependencies。

## 6. 注册查重范围不一致

- **位置**：第 2 课查 `username` 和 `email` 是否已存在；第 3 课只查 `email`。
- **后果**：按第 3 课实现时，可以用重复的用户名注册出多个账号，与模型上的 `unique` 约束冲突，报数据库唯一索引错误。
- **本次改法**：统一为 `username` 与 `email` 都查重，并返回明确的提示。

## 7. 注册接口返回值不一致

- **位置**：第 2 课返回 `{ msg: '注册成功' }`；第 3 课返回 `{ token }`。
- **后果**：前端/测试拿到两种不同结构，处理逻辑分裂。
- **本次改法**：统一为注册成功即签发并返回 `{ token }`（注册即登录），与登录接口保持一致。

## 8. `.gitignore` 内容不一致且遗漏 `.env`

- **位置**：第 1 课写 `node_modules`；第 2 课写 `node_modules/` 并追加 `.env`。
- **后果**：按第 1 课提交后 `.env` 未忽略，数据库密码与 `JWT_SECRET` 会进入版本库，分发压缩包时直接泄露。
- **本次改法**：合并为一份，包含 `node_modules/`、`.env`、`.DS_Store`、`npm-debug.log*`。

## 9. 目录结构约定冲突：选学的 `src/` vs 实际使用

- **位置**：第 2 课「进阶技巧」建议使用 `src/controllers`、`src/models`、`src/routes`、`src/middleware`、`src/utils`；第 3 课的代码实际建在项目根目录的 `models/`、`routes/`、`middleware/`。
- **后果**：两套路径混用会导致 `require` 相对路径报错。
- **本次改法**：按第 3 课的实际写法，使用根目录下的 `models/`、`routes/`、`middleware/`、`utils/`（不套 `src/`），降低学生理解成本。

## 10. curl 示例测试了不存在的接口

- **位置**：第 2 课 curl 示例里有 `GET /api/users`，但讲义从未定义该路由。
- **后果**：学生照做会得到 404，误以为自己的代码写错。
- **本次改法**：本期不实现该接口（列出用户属于管理功能，不在第 1–3 课范围）。如需保留示例，建议在讲义中标注「该接口后续课程实现」。

---

## 附：本工程额外做的轻量工程化

以下内容不属于讲义正文，属于讲义中提到的「进阶技巧」，本次一并落地：

- `utils/response.js` —— 统一响应格式 `{ success, data, message, error }`。
- `middleware/errorHandler.js` —— 统一错误处理与 404 兜底。

**由此带来的差异**：注册/登录的返回体从讲义的裸 `{ token }` 变为 `{ success, data: { token }, message }`。如果希望严格贴合讲义，可把这两处去掉，直接返回 `res.json({ token })`。

**未做的部分**：Swagger API 文档、Jest 单元测试（讲义标注为选学，本阶段跳过）。
