# 费曼学习平台 · 后端

> Web 框架：**Express 4**；运行时：**Node.js**；数据库：腾讯云 **CloudBase 文档数据库**，通过 CloudBase 服务端 SDK 访问。

《大前端与AI实战》实训项目的后端服务，基于 Node.js + Express，提供用户注册/登录（JWT 认证）、知识点 CRUD、复述/测评以及第10课向量索引能力。课程讲义仍按 Mongoose/Atlas 教学；为使用当前腾讯云数据库环境，工程数据库适配层改为 CloudBase SDK，HTTP 接口保持不变。

## 环境要求

- Node.js 18 LTS 及以上（推荐 20 / 22）
- 安装 `hnswlib-node` 时，若没有适用的预编译二进制文件，需要本机 Node-gyp C/C++ 编译环境
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
# 第10课需要时，另填 SILICONFLOW_API_KEY 与 SILICONFLOW_EMBEDDING_MODEL

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

首次使用前，在 CloudBase 文档数据库中创建 `users`、`knowledge_points`、`feynman_attempts`、`feynman_quizzes` 集合，均由后端访问；复述与测评使用ADMINONLY权限。第9课新增的`feynman_quizzes`应在启用更新后的后端前创建，关联删除也会查询该集合。若 CloudBase 配置缺失或连接失败，服务依然会启动；数据库接口会返回 503，根路由仍可用于本地调试。

## 环境变量

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `PORT` | 服务端口 | `3000` |
| `CLOUDBASE_ENV_ID` | CloudBase 环境 ID | `feynman-dev-d9gql03np7c2db9c2` |
| `CLOUDBASE_REGION` | 环境地域 | `ap-shanghai` |
| `CLOUDBASE_APIKEY` | CloudBase 服务端 API Key；只存后端 `.env`，绝不能放入前端或提交到仓库 | 仅本地配置 |
| `JWT_SECRET` | JWT 签名密钥，请用足够长的随机串 | `a_very_long_random_string` |
| `JWT_EXPIRE` | JWT 有效期 | `5h` |
| `SILICONFLOW_API_KEY` | 第10课 Embedding 的硅基流动 Bearer Key，仅后端使用 | 仅本地配置 |
| `SILICONFLOW_EMBEDDING_MODEL` | 第10课单独指定向量模型，不与生成模型配置共用 | `BAAI/bge-m3` |

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
├─ services/
│   ├─ knowledgePoints.js    # 知识点业务流程与索引队列
│   ├─ siliconflowEmbeddings.js # 硅基流动 Embedding 适配
│   └─ vectorStoreService.js # HNSWLib 本地索引
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

本地 HNSWLib 文件位于 `backend/.data/vector_store/`，由后端生成并已加入 Git 忽略；不要手工编辑或提交。知识点正文仍以 CloudBase 为准。

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
| POST | `/api/knowledge-points/:id/index` | 校验本人索引可读取；缺失、过期或损坏时重建 | 是 |
| POST | `/api/knowledge-points/index-all` | 强制重建本人全部知识点索引 | 是 |

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

## 第8课：多模型评价与复习闭环

### 配置与调用

第8/9课的模型生成当前仅启用DeepSeek，需同时配置`DEEPSEEK_API_KEY`和`DEEPSEEK_MODEL`；硅基流动的 API Key 另供第10课 Embedding 使用，其他供应商生成模型变量仍是保留项。模型从DeepSeek控制台复制有效ID，须支持system消息、非流式Chat Completions及足够的上下文；正文最多20000字符、复述最多5000字符。本实现不默认猜模型ID，不承诺模型或调用免费。

评价请求只调用DeepSeek的官方HTTPS Chat Completions接口，由Node原生fetch发送，不新增SDK依赖。服务错误或非法输出会返回错误供用户处理，不切换其他供应商。

服务端Prompt明确将参考原文和复述视为资料，不执行资料指令，要求按准确性50/覆盖度30/清晰度20评分；原文不足时需说明。结果必须是仅包含polishedText、strengths、issues、suggestions、整数score的JSON对象；润色1–6000字符，各数组最多8项、每项1–600字符，分数0–100。严格校验；非法输出不猜测修复，也不切换其他服务。响应体上限256000字节。

单次20秒、整轮90秒时限；DeepSeek网络、认证/额度/限流、服务错误和非法输出均返回错误，用户可检查配置后手动重试。可识别的安全拒绝立即停止；用户取消也停止。每用户1轮、每进程最多4轮，超出429；该进程限流不能当作跨进程全局限流。

### 接口及数据

| 方法与路径 | 行为 |
| --- | --- |
| POST `/api/knowledge-points/:id/attempts/:attemptId/evaluate` | 无需提交文字；校验归属后读取已保存复述，生成或复用评价并补做复习标记 |
| GET `/api/knowledge-points/:id/attempts/:attemptId/evaluation` | 只读评价，未评价404，不产生模型调用 |
| GET `/api/ai/metrics` | 本人DeepSeek调用统计，不返回用户隐私字段 |

继续用x-auth-token和统一响应。评价data为`{attemptId,originalText,evaluation,sourceChanged}`。evaluation包含统一反馈字段、provider/providerName/model、durationMs、evaluatedAt、providerAttempts（本轮已尝试的供应商、耗时、安全错误码与结局）、metricsIncomplete、reviewStatus，以及source（title/content/revision/fingerprint）。旧复述不存在evaluation，历史列表只附加hasEvaluation标记，不批量传输评价与原文快照。

复述文档通过条件更新获得120秒租约，包含随机token与until；占用中409，租约过期后可重新尝试，写回必须匹配token且尚无评价。成功结果写入同一feynman_attempts文档，重复POST读取缓存。未落库结果在当前进程暂存10分钟，最多64项，满时拒绝新调用；数据库恢复后的同进程重试可复用结果，重启、换进程、过期后不保证复用。外部调用与数据库不是分布式事务，不承诺严格一次调用或不重复计费。取消只保证停止本地等待，不能撤回已经发出的请求。

低于60分才处理reviewList，状态为pending/applied/failed/source_changed/not_needed。先核对标题正文SHA256指纹，再通过原有版本更新只改reviewList为true，保留知识点历史与status，版本冲突最多重新读取重试一次。高分不取消已有标记；源文本变化保留评价且跳过自动标记。评价先落库，复习失败不丢评价；再次POST仅补做，applied不重复强制设置。复习更新与评价状态记录不是跨文档事务，状态写回失败后可能需要再次核对，不能保证对并发人工操作的全局顺序。

DeepSeek调用后，users文档`llmMetrics.deepseek`原子累加calls、successes/failures/cancelled、durationMs（仅非取消调用）。成功指返回并校验通过的反馈；取消不计服务失败。统计接口返回calls、successes、failures、cancelled、successRate、averageDurationMs及configured；无已完成请求时比例/平均值为null。统计写入失败不影响评价，成功评价记录metricsIncomplete；丢失的统计无法自动补录。

没有新增集合或迁移旧记录，字段按需写入；知识点JSON备份与版本历史不混入复述评价。删除知识点沿用关联复述清理。保存评价前再次检查归属、删除状态，不信任客户端传入原文/评分。错误、日志不包含完整请求、上游响应或密钥。

官方协议来源：
- DeepSeek：https://api-docs.deepseek.com/api/create-chat-completion/

以上为代码设计与静态审阅记录，非真实服务接通证明；本轮按用户要求不运行测试、构建或浏览器验收。

## 第9课：DeepSeek出题与测评

### 配置及数据

新增文档集合`feynman_quizzes`，用户手动创建并设置ADMINONLY权限后再启用更新。使用现有CloudBase服务端Key以及DeepSeek Key/MODEL，不增加供应商配置或应用依赖。缺集合或数据库故障返回503及明确的测评集合提示。

每条文档是一道题及一次正式作答：`user,knowledgePointId,requestKey,type,difficulty,createdAt,source,question,generation,answer,submittedAt,result,lease,operationError`。source保存标题、正文、版本和SHA256指纹；question含标准答案/答案要点，仅后端持有；generation/result保存供应商、模型、耗时、时间及统计不完整标记，result另有score/isCorrect/explanation/reviewStatus。不保存密钥或原始上游对象。

知识点删除先标记deleting，再按所属用户清理测评、复述，最后删除知识点；失败保留删除状态，可重试。测评不混入知识点版本历史或JSON备份。部署前必须创建新集合，关联删除也依赖它；不要把连接检查users成功当成新集合可用证明。

### 接口

以下均使用x-auth-token，返回`{success,data,message,error}`。知识点及测评归属由服务端验证，写入前再次检查知识点删除状态。

| 方法与路径 | 输入与行为 |
| --- | --- |
| POST `/api/knowledge-points/:id/quizzes` | `{type,difficulty,requestKey}`；生成或复用题目，返回publicQuiz |
| GET `/api/knowledge-points/:id/quizzes` | 最近20条摘要，含编号、题型、难度、题干摘要、创建时间、状态；已完成时附分数/对错 |
| GET `/api/knowledge-points/:id/quizzes/:quizId` | 只读publicQuiz，不出题、不评分、不补做复习 |
| POST `/api/knowledge-points/:id/quizzes/:quizId/answer` | `{answer}`；提交或复用评分，并补做复习标记，返回publicQuiz |

type限定`single-choice/short-answer`，difficulty限定`basic/medium/hard`；requestKey为16–80位字母、数字或横线，用户+知识点+标识确定文档ID。同标识改变题型/难度返回409。原文快照固定于首次创建，原文变化后希望针对新内容练习应使用新的requestKey。

publicQuiz含`_id,type,difficulty,createdAt,status,requestKey,knowledgePointId,sourceTitle,sourceRevision,sourceChanged,operationError,generation`；出题成功后附`question:{text,options?}`；接受作答后附`answer,submittedAt`；评分完成后附`result`，此时才公开correctAnswer或answerKeyPoints。列表和未完成题目不会泄露标准答案或评分要点。状态为generating/generation_failed/awaiting_answer/grading/grading_failed/completed；无活动租约的未完成阶段可由用户手动重试。

单选答案为A/B/C/D，服务端直接判0或100，不调用模型；简答trim后1–5000字符，评分0–100整数，60分为答对边界。服务端原子接受答案后不可更改，原样重试读取结果或恢复评分，不同答案409。首次提交尚未被接受时，读取记录可确认真实状态。

出题JSON严格校验字段、题型、难度和长度：题干1–2000、四个不同选项各1–1000、解析1–3000、简答要点1–8条且每条1–1000。评分只接受score和explanation，解释1–3000。原文不足允许特定cannotGenerate响应并转成422。Prompt将原文、题目、学生答案作为资料，不执行其中指令；不执行模型代码或修补猜测的答案。

### 可靠性与复习

第8/9课共享本进程的每用户1轮、最多4轮AI业务限制，以及最多64项待补存容量；单进程限制不等于分布式全局限流。单次DeepSeek20秒、整轮90秒，CloudBase SDK请求本身不能由AbortSignal回滚；不自动重试、不切换供应商。每次真实模型尝试累计到本人llmMetrics.deepseek，取消单独统计，统计失败不丢业务结果。

生成和评分用120秒token租约及条件更新。答案与评分租约原子写入；结果必须匹配租约且对应阶段尚无成功结果才能写回。模型成功后在本进程暂存10分钟，数据库写入失败原样重试优先补存；容量满时拒绝新工作，空占位失败后释放。进程重启、多进程切换、过期、时钟偏差或数据库长时间阻塞均不能保证严格一次外部调用，已发出的请求可能计费。

答错仅更新reviewList=true，先核对原文指纹，再沿用知识点revision条件更新及历史保护；冲突重读一次。高分不清标记、不改status。复习状态pending/applied/failed/source_changed/not_needed；评分先保存，复习失败不丢结果，重复答案POST只补做。applied后不会因重复查看强制恢复标记；知识点更新与测评状态写回跨文档，不保证事务或并发人工操作的全局顺序，写回失败会独立告警。

本轮为代码及静态审阅交付，未运行测试/构建/服务、浏览器或真实模型验证。保留原讲义；讲义的前端单选比较示例改为服务端判分，以隐藏标准答案并保护归属与结果。

## 第10课：RAG 知识入库

### 配置与分块

在后端配置 `SILICONFLOW_API_KEY` 与独立的 `SILICONFLOW_EMBEDDING_MODEL=BAAI/bge-m3`。适配器使用硅基流动 `POST https://api.siliconflow.cn/v1/embeddings`，请求头为 `Authorization: Bearer ...`，正文为 `{model,input}`。Embedding 输入按当前 API 格式支持字符串数组；本实现每批最多发送8个分块，每次请求30秒超时。`BAAI/bge-m3` 文档列出的最大输入长度为8192 tokens；课程分块仍按500字/重叠50字执行。服务端校验响应条目、序号、维数与有限数值，不记录 Key 或原始上游响应。

正文与标题组合后按 Unicode 字符分块，目标每块最多500字、相邻块重叠50字，优先在标点处切分。每个用户与知识点组合有独立 HNSWLib cosine 索引，目录名为两者组合的 SHA-256；索引含 HNSW 文件、分块文本/元数据和 manifest。元数据记录用户、知识点编号、内容版本和分块位置。临时索引构建完整后才替换旧索引；索引文件权限限制为当前系统用户。CloudBase 知识点正文是权威数据，本地文件是可重建的派生索引。

### 自动更新、重建与状态

新建、导入、标题/正文变更和版本恢复会把索引加入后台队列，最多并行处理2条。索引版本使用 `contentRevision`：只有标题或正文变化才递增；普通 `revision` 仍代表包括状态、分类和标签在内的全部知识点变更。因此只改状态、分类、标签或复习标记不会调用 Embedding。构建失败不回滚已保存的笔记；`vectorIndexStatus` 标为 `failed`，错误只以安全错误码展示，之后可以手动重试。删除先标记知识点，再删除对应本地索引与测评/复述记录；任一步失败保留删除标记，可再次调用删除继续清理。

知识点详情及列表额外返回 `contentRevision`、`vectorIndexStatus`、`vectorIndexedRevision`、`vectorIndexModel` 和 `vectorIndexErrorCode`。状态可能为 `unindexed`（旧数据尚未处理）、`pending`、`ready` 或 `failed`；“已加入队列”不代表已完成，需查看后续知识点状态。

| 方法与地址 | 行为 | 返回 |
| --- | --- | --- |
| POST `/api/knowledge-points/:id/index` | 仅按认证身份查找本人索引；验证索引文件可读取且版本匹配时返回ready，否则排队重建 | HTTP 200 ready或HTTP 202 pending，含知识点编号与内容版本 |
| POST `/api/knowledge-points/index-all` | 对认证用户现有的全部未删除知识点加入强制重建队列 | HTTP 202，每条知识点的状态/内容版本及无法排队项 |

新建、导入、正文/标题编辑和版本恢复会按分块调用 Embedding，可能产生供应商费用；全部重建会对每条知识点强制重新调用，可能重复计费。只在有硅基流动额度和凭据时手动执行。新建/编辑即使未配置硅基流动也会保存笔记，状态变为失败，配置完成后可用单条或全部重建接口补齐。响应仅接受身份令牌，不读取请求体里的用户编号；单条操作会先校验知识点归属。笔记分块会发送给硅基流动处理，配置前请确认其适用于你存储的内容。

### 手动验收与运行边界

本地验收时配置硅基流动凭据后重启后端：依次新建知识点、改标题/正文、导入、恢复旧版本，观察内容版本增加且索引变为 `ready`；仅改状态/标签时确认内容版本不变；尝试重建他人知识点应返回403；删除后确认索引目录清理。另分别缺少凭据、制造供应商超时/错误，确认笔记仍保存且状态可重试；后端重启后对本人笔记发单条索引检查，确认 HNSW 文件可读取并识别为当前版本。全部重建会重新请求向量，不作为无成本的状态检查。

这是单后端实例、持久本机磁盘的教学原型。多实例、容器临时盘或无持久卷环境不适用，需另行设计共享向量存储与任务协调。当前没有第11课检索问答或聊天接口。本轮未配置或请求真实硅基流动服务，也未运行自动测试、构建、服务或浏览器验收；Node 原生 HNSWLib 依赖仅完成本机依赖编译。

官方协议：
- [硅基流动 Embedding API](https://api-docs.siliconflow.cn/docs/api/embeddings-post)
- [硅基流动 API Key 创建说明](https://docs.siliconflow.cn/docs/userguide/quickstart)
