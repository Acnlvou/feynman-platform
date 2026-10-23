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

## 第6课新增接口与数据（2026-10-23）

知识点业务集中于 `backend/services/knowledgePoints.js`；CloudBase 访问仍集中在 models。所有新增接口继续使用 `x-auth-token`，只访问当前用户的数据。

| 方法 | 路径（前缀 `/api/knowledge-points`） | 说明 |
| --- | --- | --- |
| GET | `/export` | 导出当前用户全部当前状态，返回 `format/version/exportedAt/knowledgePoints` |
| POST | `/import` | 校验整个批次后逐条创建副本，返回 `created` 和 `failed`（含批内 index） |
| GET | `/:id/history` | 当前版本在前，之后按时间倒序排列旧版 |
| POST | `/:id/restore` | 请求 `{version, revision}`，恢复旧版为新版本 |

知识点新增 `category`（空串表示未分类）、`tags`（字符串数组）、`revision`（从1递增）、`history`（内部快照数组）。旧记录缺省按空分类、空标签、版本1读取，不执行批量迁移；首次实际更新开始保存历史。列表和普通详情不返回 history，备份仅白名单业务字段。

PUT 可以携带预期 revision，前端始终传入；旧调用方不传仍兼容，但无法检测其读取后已发生的修改。模型更新采用原子版本条件，冲突返回409。恢复也要求预期 revision，恢复所有业务字段；无变化保存不新增版本。每次变更保存原版本，最多10个旧版本且旧版 JSON UTF-8总大小不超过300000字节；超过时删除最旧快照，避免文档无限增长。

导入 JSON 格式：`{format:"feynman-knowledge",version:1,knowledgePoints:[{title,content,status,reviewList,category,tags}]}`。单批1–30条，HTTP JSON上限1MB。可传同长度 importKeys 数组（每项16–80位字母、数字或横线）；同用户、同key、同业务内容映射到固定编号，重试不重复创建。前端为每个预览项生成随机key。重新导入文件生成新副本，不合并或覆盖旧记录。不信任文件中的 user、_id、history 等字段。

后端强制校验：标题1–120字符、正文1–20000字符、分类0–40字符、标签最多10个且每个1–20字符；状态枚举与复习标记类型同原约定。导入整批先校验，非法项导致400且该批不写入；数据库故障时可能部分成功，客户端按 returned failed重试。403表示跨用户，404表示记录或历史不存在，409表示版本冲突。

在 `backend/` 执行 `npm run test:lesson6` 使用内存替身验证 HTTP 与业务，不连接云端。真实 CloudBase 结果单独记录在变更记录中。

## 第7课：录音识别与复述保存

本节描述代码行为，尚未做运行或云端验证。语音识别使用百度短语音识别标准版普通话模型（`dev_pid:1537`），通过 HTTPS REST API 调用，未采用百度SDK。Node原生fetch用于认证和识别，multer 2负责内存上传。识别有独立服务层，CloudBase SDK访问仍集中在models。

### 手动配置

1. 在百度智能云语音技术控制台创建应用，开通短语音识别标准版，并确认权限与可用额度。CloudBase服务端Key不能代替百度凭据。
2. 将该应用的 `BAIDU_API_KEY`、`BAIDU_SECRET_KEY` 填入本机被忽略的 `backend/.env`，再手动重启后端。本REST调用不要求 `BAIDU_APP_ID`，不需要配置任何 `VITE_*` 密钥。
3. 在现有CloudBase环境中新建文档集合 **`feynman_attempts`**，仅后端访问，不必开放客户端读写权限。已有 `users`、`knowledge_points` 不迁移。集合缺失会影响复述保存、历史查询和知识点关联删除，部署该版前先建集合。
4. 复述列表查询按 `user`、`knowledgePointId` 过滤，再按 `createdAt` 倒序、`_id` 升序取20条。若环境要求复合索引，创建 `user ASC, knowledgePointId ASC, createdAt DESC, _id ASC` 对应索引。

### 新增接口

均要求 `x-auth-token`；响应继续使用 `{success,data,message,error}`。所属用户来自认证身份，客户端不能指定所属用户。

| 方法与地址 | 输入 | 成功data |
| --- | --- | --- |
| POST `/api/audio/transcribe` | multipart字段 `audio`（单个WAV文件）、`knowledgePointId` | `{text,duration}`，duration单位秒 |
| POST `/api/knowledge-points/:id/attempts` | JSON `{text,duration,saveKey}` | `{_id,knowledgePointId,text,duration,createdAt}` |
| GET `/api/knowledge-points/:id/attempts` | 无 | 最近20条复述数组，同上字段 |

- 上传先认证、限并发，再进行内存解析：每用户1个、每进程最多4个请求；文件最多2MiB，仅一个文件与一个短字段。后端实际解析RIFF/WAVE格式块与数据块，校验PCM、16kHz、单声道、16位、字节率/块对齐和时长（大于0且不超过60秒），不信任MIME、后缀或客户端时长。
- 百度只接收解析后的PCM数据。认证请求10秒超时，Token按返回有效期提前60秒刷新，相同凭据的并发取Token合并；识别请求30秒超时。不自动重试识别请求，Token失效时清缓存，下一次手动请求重新认证。
- 缺配置、服务未开通、凭据错误或额度受限给出503安全提示；上传超限413、参数400、无清晰语音422、并发限制429、识别超时504；跨用户403、不存在404、知识点正在删除409。外部网络或其他识别失败返回502，不透传上游响应对象或凭据。
- 保存文字1–5000字符、时长大于0且不超过60秒；saveKey为16–80位字母、数字或横线。用户+知识点+保存标识生成确定文档ID，响应丢失后的原样重试返回同一记录；同标识不同内容返回409。手动编辑后需使用新saveKey。
- `feynman_attempts` 文档字段：`_id,user,knowledgePointId,text,duration,createdAt`；不保存音频、百度Token或凭据。查询只输出业务字段，最近20条为展示范围，不是自动删除规则。
- 删除知识点前先将其标为 `deleting:true`，阻止新录音转录/复述保存及常规编辑，再按用户与知识点分批清理复述，最后删知识点；失败保留删除标记，用户可从知识库再次删除继续清理。保存后再次检查归属/删除状态，处理并发删除。跨集合清理不提供事务回滚，失败时可能已有部分复述删除。
- 知识点版本历史与JSON备份继续只包含原业务字段，不包含复述或删除标记。新接口不调用或扩展AI评分。

上传在内存处理，请勿在反向代理或外部采集系统中另行启用请求体记录。前端超时或断开会尝试取消上游请求，但已经发送给百度的音频无法撤回，也不能保证不计费。本站不持久化音频不代表百度的服务端数据策略；上线前应按实际使用方式核对服务条款。
