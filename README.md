# 费曼学习平台（Feynman Platform）

《大前端与 AI 实战》64 学时 / 16 次课的贯穿式项目。

> 统一仓库说明：后端代码、后续前端代码、课程讲义、项目计划、技术说明、变更记录和参考材料均收纳在本目录；文档按用途放入 `docs/`，后端工程放入 `backend/`，前端工程放入 `front/`。

## 当前进度

- 已完成第 1–3 次课：Express 服务、用户注册/登录、JWT 认证、知识点 CRUD。
- 已整理第 1–16 次课讲义、第 7.5 次进阶课及第 8 课的三个版本，共 19 份文稿课程资料；原有路径调整版与文稿原版均保留。
- 已完成第 4 次课前端起步与第 5 次课核心联调：React + Vite、路由、登录/注册、认证状态、路由守卫、知识点列表与创建/删除。
- 已完成第 6 次课基础、进阶与挑战项：知识点 CRUD、富文本渲染、搜索、分类标签、Markdown/JSON 导入导出和版本历史恢复。
- 编辑页和详情页固定在视口内，正文区域独立滚动；新增操作沿用紧凑布局。
- 第7课录音、百度语音转文字、复述文字保存和历史页面代码已接入，待用户配置凭据/集合并手动验收；未做运行验证。
- 页面统一为浅色顶部导航工作台：首页进入 `/knowledge`，学习概览位于 `/overview`，新建入口进入 `/knowledge/new`；桌面并排编辑与实时预览，手机切换视图。
- 前端代码统一放在 `front/`；下一阶段继续完善复习功能，以及第 7 课起的录音与 AI 能力。
- 后端已接通腾讯云 CloudBase 文档数据库，真实注册/登录、知识点增删改查、用户权限隔离和重启后的数据保留已验证。

## 目录结构

```text
feynman-platform/
├── README.md                         # 项目入口说明
├── .gitignore                        # 统一仓库忽略规则
├── backend/                          # Node.js + Express + CloudBase 后端
│   ├── index.js
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   ├── package.json
│   └── .env.example
├── front/                            # React + Vite 前端代码
│   ├── src/
│   ├── package.json
│   └── README.md
└── docs/
    ├── 课程讲义/                      # 第 1–16 次课、进阶课及多版本讲义
    ├── 项目计划/                      # 全项目路线图与阶段实施计划
    ├── 技术文档/                      # 后端 README、讲义勘误等技术说明
    ├── 变更记录/                      # 按日期记录项目变更
    └── 参考资料/幻灯片/                # PPT 与课程参考材料
```

## 后端技术栈

后端使用 **Node.js + Express 4**，通过 CloudBase 服务端 SDK 访问腾讯云文档数据库。课程讲义仍保留 Mongoose/Atlas 的教学示例；当前工程的 CloudBase 配置不使用 `MONGO_URI`。此外还使用：

- `bcryptjs`：密码哈希
- `jsonwebtoken`：JWT 登录认证
- `dotenv`：环境变量配置
- `cors`：跨域请求处理

后端 Web 框架是 **Express**，运行时是 **Node.js**，持久存储使用 **腾讯云 CloudBase 文档数据库**。

## 前端技术栈

前端使用 **React 19 + Vite**（`react-router-dom` 路由、`axios` 请求），第 6 课新增的开源渲染依赖：

- `react-markdown` + `remark-gfm`：Markdown 与 GFM 语法（表格、任务列表）
- `remark-math` + `rehype-katex` + `katex`：LaTeX 数学公式
- `mermaid`：流程图、时序图等图表

富文本引擎通过 `React.lazy` 按需加载，首次访问不会下载；`katex` 版本与 `rehype-katex` 的依赖保持一致，避免样式与标记版本错位。

## 快速启动后端

本机已配置好数据库，可双击根目录的 `启动项目.command`，同时启动前端与后端；在启动窗口按 Ctrl+C 会停止两者。脚本优先使用本机已有的 Codex Node.js，其他电脑使用系统 Node.js，无需额外安装运行时。

以下步骤适用于首次配置的新电脑；已有 `.env` 时请保留原配置：

```bash
cd backend
npm install
cp .env.example .env
# 编辑 .env，填写 CLOUDBASE_APIKEY 与 JWT_SECRET
npm start
```

启动后访问 <http://localhost:3000/>，应看到 `Hello, Feynman Learner!`。

即使没有配置 CloudBase，后端也会启动；数据库相关接口会返回明确的未连接提示。完整接口清单和测试示例见 [`docs/技术文档/backend-README.md`](docs/技术文档/backend-README.md)。

## 文档导航

### 课程讲义

- [全部 19 份文稿讲义总目录](docs/课程讲义/README.md)
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
- [接通腾讯云文档数据库](docs/变更记录/2026-10-09-接通腾讯云文档数据库.md)
- [第 6 课：知识点详情、编辑与富文本渲染](docs/变更记录/2026-10-16-第6课知识点详情编辑与富文本渲染.md)

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

- [第 6 课挑战项与验证记录](docs/变更记录/2026-10-23-第6课挑战项补齐.md)

- [第7课录音与复述实现记录（待手动验收）](docs/变更记录/2026-10-23-第7课录音与复述.md)
