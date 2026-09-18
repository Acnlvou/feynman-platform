# 费曼学习平台（Feynman Platform）

《大前端与 AI 实战》64 学时 / 16 次课的贯穿式项目。

> 统一仓库说明：后端代码、后续前端代码、课程讲义、项目计划、技术说明、变更记录和参考材料均收纳在本目录；文档按用途放入 `docs/`，后端工程放入 `backend/`，前端工程放入 `front/`。

## 当前进度

- 已完成第 1–3 次课：Express 服务、用户注册/登录、JWT 认证、知识点 CRUD。
- 已整理第 1–6 次课讲义，作为 `docs/课程讲义/` 的课程资料。
- 当前下一阶段：第 4–6 次课前端工程与前后端联调（React + Vite、认证状态、知识点界面），代码统一放在 `front/`。
- 后端语法检查已通过；是否连接 MongoDB Atlas 取决于本地 `backend/.env` 配置。

## 目录结构

```text
feynman-platform/
├── README.md                         # 项目入口说明
├── .gitignore                        # 统一仓库忽略规则
├── backend/                          # Node.js + Express + MongoDB 后端
│   ├── index.js
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   ├── package.json
│   └── .env.example
├── front/                            # 后续 React + Vite 前端代码
│   └── README.md
└── docs/
    ├── 课程讲义/                      # 第 1–6 次课《大前端与 AI 实战》讲义
    ├── 项目计划/                      # 全项目路线图与阶段实施计划
    ├── 技术文档/                      # 后端 README、讲义勘误等技术说明
    ├── 变更记录/                      # 按日期记录项目变更
    └── 参考资料/幻灯片/                # PPT 与课程参考材料
```

## 后端技术栈

后端使用的是 **Node.js + Express 4** 框架，数据库层使用 **Mongoose** 连接 **MongoDB Atlas**。此外还使用：

- `bcryptjs`：密码哈希
- `jsonwebtoken`：JWT 登录认证
- `dotenv`：环境变量配置
- `cors`：跨域请求处理

所以更准确地说：**后端 Web 框架是 Express，运行时是 Node.js，数据库是 MongoDB。**

## 快速启动后端

```bash
cd backend
npm install
cp .env.example .env
# 编辑 .env，至少填写 MONGO_URI 与 JWT_SECRET
npm start
```

启动后访问 <http://localhost:3000/>，应看到 `Hello, Feynman Learner!`。

即使没有配置 MongoDB，后端也会启动；数据库相关接口会返回明确的未连接提示。完整接口清单和测试示例见 [`docs/技术文档/backend-README.md`](docs/技术文档/backend-README.md)。

## 文档导航

### 课程讲义

- [第 1 次课：导论与后端初探](docs/课程讲义/01《大前端与AI实战》第一次课程：导论与后端初探.md)
- [第 2 次课：API 设计与数据库实战](docs/课程讲义/02《大前端与AI实战》第二次课程：API设计与数据库实战.md)
- [第 3 次课：认证与核心业务 API](docs/课程讲义/03《大前端与AI实战》第三次课程：认证与核心业务API.md)
- [第 4 次课：前端起航与界面搭建](docs/课程讲义/04《大前端与AI实战》第四次课程：前端起航与界面搭建.md)
- [第 5 次课：前后端联调与状态管理](docs/课程讲义/05《大前端与AI实战》第五次课程：前后端联调与状态管理.md)
- [第 6 次课：知识点模块与富文本渲染](docs/课程讲义/06《大前端与AI实战》第六次课程：知识点模块与富文本渲染.md)

### 计划与技术文档

- [全项目执行计划](docs/项目计划/00%20费曼学习平台·全项目执行计划.md)
- [后端第 1–3 课实现计划](docs/项目计划/01%20费曼学习平台后端·第1–3课实现计划.md)
- [后端工程说明](docs/技术文档/backend-README.md)
- [讲义勘误说明](docs/技术文档/backend-errata.md)
- [项目变更记录](docs/变更记录/2026-09-11-后端工程从零搭建与讲义勘误.md)

## Git 约定

这是项目根目录的唯一 Git 仓库。提交信息沿用课程约定：

```text
feat: 新功能
fix: 修复问题
docs: 文档变更
refactor: 重构
chore: 工程维护
```

不要提交 `node_modules/`、`.env`、构建产物或任何真实密钥。后端原先的独立 Git 历史已合并到本根仓库的首个整理提交中，后续统一在 `feynman-platform/` 内进行版本控制。
