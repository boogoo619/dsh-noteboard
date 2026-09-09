<h1 align="center">dsh-noteboard</h1>

<p align="center">中文 | <a href="README.en.md">English</a></p>

<p align="center">
  DeepSeek Harness（DSH）的便签画布插件：在会话视图中提供一块工作区级的无限画布。便签为 Markdown 文件，画布为 JSON Canvas 布局文件，内容与摆放分离，可由文本编辑器与 Git 直接管理。支持从对话中采集文字生成便签，以及将便签作为结构化引用发回输入框交给模型处理。
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license">
  <img src="https://badgen.net/badge/dsh/%3E%3D0.1.2-rc.1/blue" alt="dsh version">
  <img src="https://badgen.net/badge/node/%3E%3D22.19/blue" alt="node version">
</p>

## 效果 📸

**画布总览**

![画布总览](screenshots/canvas-overview.png)

**便签引用输入**

![便签引用输入](screenshots/cite-notes.png)

**从对话采集便签**

![从对话采集便签](screenshots/capture-from-chat.png)

**从便签返回会话位置**

![从便签返回会话位置](screenshots/backlink-jump.png)

<!-- 截图请放到 screenshots/ 目录：
     - canvas-overview.png —— 画布总览：多张不同颜色的便签 + 分类标题 + 顶部工具栏
     - cite-notes.png —— 输入态：底部输入框展开，上方挂着 2–3 个便签引用气泡
     - capture-from-chat.png —— 对话视图中框选一段文字，浮出「存入画布 / AI 提炼」按钮
     - backlink-jump.png —— 点击便签「来源 / 打开对话」后跳转到对话视图、原文位置高亮的效果 -->

## 功能 ✨

- **无限画布** —— 平移、缩放、框选批量移动、网格吸附，可添加自由文本与自动分类标题；同一批便签可保存多张画布布局，随时切换
- **Markdown 便签** —— 每张便签是一个带 frontmatter 的 `.md` 文件；编辑器实时预览，七种颜色、亮暗双主题
- **从对话采集** —— 框选对话文字，「存入画布」原文保存或「AI 提炼」浓缩成便签
- **来源回链** —— 每张采集的便签都记录它来自哪次会话的哪段文字；点「打开对话」直达原文位置并高亮，看完一键返回画布
- **发回给 AI** —— 便签以引用气泡加入输入框，随消息发送结构化引用；累计超过 32,000 字符阻止发送
- **整理** —— 标签胶囊聚焦过滤、按标签自动重排（先备份、可恢复）、搜索标题 / 正文 / 标签、便签库找回离板便签
- **AI 工具** —— 12 个工具与 5 个内置工作流，支持会话范围读取、筛选提取、查询、修改、整理和综合便签（见下）
- **历史与恢复** —— 每次写操作可查看前后差异并恢复，后续修改冲突时拒绝覆盖

## AI 工具与工作流 🤖

随插件注册 12 个模型工具：

| 工具 | 说明 |
| --- | --- |
| `canvas_add_note` | 创建一张便签放入指定画布，可记录 `derivedFrom` 依据 |
| `noteboard_query` | 搜索工作区便签，或按 ids 读取全文、版本与来源 |
| `noteboard_create` | 批量创建便签（单次最多 200 张），支持共用/逐张来源和可选精确去重 |
| `noteboard_sessions` | 按标题或 ID 查找当前工作区的来源会话，分页返回元数据 |
| `noteboard_read_session` | 按序号、时间和角色读取当前或指定会话原文，支持长消息续读 |
| `noteboard_update` | 修改便签（须携带读取时版本）；可按颜色分组批量着色，内容和颜色修改影响所有画布 |
| `noteboard_add` | 把已有便签放入指定画布，不复制文件 |
| `noteboard_remove` | 仅从指定画布移除便签，保留文件 |
| `noteboard_layout` | 按标签重排、按指定 ID 顺序排列、对齐或分布便签（须携带画布版本） |
| `noteboard_save_as` | 另存画布布局 |
| `noteboard_history` | 列出操作记录，可查看文件修改前后全文 |
| `noteboard_restore` | 恢复指定操作，检测后续修改冲突并拒绝覆盖 |

以及 5 个内置工作流（Skill）：

| 工作流 | 说明 |
| --- | --- |
| `noteboard-extract` | 从会话、指定范围、文件或引用材料中按条件筛选，整理并保存为带来源的便签 |
| `noteboard-organize` | 按主题归类、加标签、按内容特征着色，按版本号、时间或优先级排列便签 |
| `noteboard-compare` | 比较便签中的方案、权衡优缺点、识别分歧 |
| `noteboard-actions` | 把便签中的想法拆解为行动项或实施步骤 |
| `noteboard-synthesize` | 合并重复便签、去重或综合多个结论 |

普通操作使用会话模型；「AI 提炼」的模型在插件设置中单独配置。

例如：“把这些版本便签按更新特征着色，再按版本号升序排列，每行 4 张。”模型读取正文并确定颜色映射和版本顺序，按颜色分组调用 `noteboard_update`，再读取最新画布版本，调用 `noteboard_layout` 的 `action: "ordered"`，把排好序的 ID 放入 `ids`，设置 `columns: 4`。工具严格保留这个顺序，逐行排列，保留原标签和尺寸，并避开未选中的画布对象。`columns: 1` 为纵列；省略时使用接近正方形的网格。版本顺序由模型判断，布局工具不解析版本号；`rearrange` 仍用于按首标签分区。操作可在历史记录中恢复。

### 按条件提取便签

例如：“把当前会话中已经确定的产品决策整理成便签，排除候选方案。”或“从指定会话今天下午的讨论里提取未解决问题，每个问题一张，先给预览。”`noteboard-extract` 会沿用指定范围和模板；要求预览时只返回草稿，要求保存时读取现有便签进行去重，再调用创建工具。

- `noteboard_sessions` 只检索当前工作区的会话标题和 ID。指定其他工作区的来源时使用用户提供的会话 ID，创建结果仍保存到执行会话的工作区。
- `noteboard_read_session` 省略 `sessionId` 即读取当前会话。`fromSeq/toSeq` 为事件序号，`fromTime/toTime` 为 Unix 毫秒，两端均包含；事件序号不是对话轮数。`roles` 可选择 `user`、`assistant`。
- 返回原始记录中的对话文本，包括压缩前原文；排除思考、工具输出和注入上下文，不解析图片或附件。工具返回 `nonTextBlocks` 提示所选范围含非文本材料。
- 默认每页最多 40 条消息、12,000 字符。`next` 非空时将其完整对象作为下一次调用参数，直到 `complete: true`。续读终点固定为首轮捕获的范围，期间新增消息需另行读取。超长消息用 `start/end` 标记片段位置，可按 `seq` 拼接原文。
- 来源保存在现有 `source` 字段：会话使用 `sessionId/seq/label/text`，文件使用 `path/startLine/endLine/label/text`，网页使用 `url/label/text`。批量调用的 `source` 为默认值，每张便签可覆盖。多来源结论在正文逐项引用，`source` 记录主要来源；原有会话回链继续可用，文件与网页来源目前保存为元数据。
- `deduplicate: true` 仅跳过目标画布上及同批中标题、正文相同的便签（忽略首尾空白），返回带输入索引和已有 ID 的 `skipped`；不修改已有便签。默认关闭。语义去重由工作流读取正文后判断，重试前应查询实际落盘结果。

历史会话查找和读取依赖宿主 `sessionQuery`；当前会话可直接读取执行上下文中的 Session。服务不可用时明确报错。文件和网页内容使用宿主已有的读取工具。

## 安装 📦

需要 `dsh` CLI（`>= 0.1.2-rc.1`），Node `>= 22.19.0`。

**从 GitHub（当前）**

```sh
dsh plugin --profile web add github:boogoo619/dsh-noteboard
dsh web
```

> git 安装拉取**源码**并由 `prepare` 脚本现场构建。pnpm ≥10 会先拒绝运行 `prepare`，首次 `add` 失败后，按 `dsh` 提示把包键复制进该 profile 的 `pnpm-workspace.yaml`：
>
> ```yaml
> allowBuilds:
>   dsh-noteboard: true
> ```
>
> 然后重新执行 `add`。**该授权允许本包代码在安装时于你的机器上执行**——请只对可信来源授权，并锁定 commit（`github:boogoo619/dsh-noteboard#<sha>`）。

**从 npm（包发布后可用）**

```sh
dsh plugin --profile web add dsh-noteboard
dsh web
```

> 如果 `add` 装到的不是最新版本：这是 pnpm 的 `minimumReleaseAge`（最小发布年龄）安全机制在起作用——默认 **24 小时**内不会把刚发布的版本当作 `latest` 解析，而是回退到上一个稳定版。想立即装最新版，显式指定版本号即可：
>
> ```sh
> dsh plugin --profile web add dsh-noteboard@<版本号>
> ```

本地开发使用 link：

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-noteboard
```

安装后重启 `dsh web` 生效。

## 数据格式 🗂️

```
<workspace>/.noteboard/
├── meta.json                      # { "activeCanvas": "Main" }
├── canvases/<名称>.canvas         # JSON Canvas 1.0 布局（Obsidian Canvas 兼容）
├── notes/<日期>-<标题>-<短id>.md  # 便签本体：Markdown + YAML frontmatter
└── history/                       # 操作历史
```

- 便签 frontmatter：`id`、`title`、`color`、`tags`、`created`、`source`（回链）、`derivedFrom`（综合依据）；未识别字段一律保留
- 画布文件只描述布局：节点 `id` 与便签 `id` 互为外键，`text` 使用 Obsidian 风格相对引用；其他 JSON Canvas 工具可直接打开
- 内容版本为 SHA256；写入走队列并做冲突检查

## 设置 ⚙️

侧栏「设置 → 插件」中的「便签画布」默认折叠，展开后按以下四组配置。偏好通过宿主保存，作用于各工作区；画布视图位置按工作区和画布分别记忆。

| 选项 | 说明 |
| --- | --- |
| 划词采集工具栏 | 默认开启，可关闭对话文字选择后的采集入口 |
| 采集完成后 | 留在对话（默认）或打开便签；切换会话后不会自动跳转 |
| 新便签默认颜色 | 七种颜色，默认黄色；仅影响新便签，明确指定颜色时优先使用指定值 |
| 背景网格 / 拖动吸附 | 默认均开启，独立控制；步长统一为 24 个画布单位，不重排已有内容 |
| 普通滚轮操作 | 平移（默认）或缩放；Ctrl / Command + 滚轮及捏合始终缩放 |
| 打开画布时的视图 | 恢复上次视图（默认）或显示全部；明确定位便签的请求优先 |
| 模型提供方 / 提炼模型 | 自动选择首个能列出模型的提供方及其首个模型，并显示当前实际选择；指定项失效会报错 |
| 提炼正文长度 | 简短约 100 字 / 标准约 200 字（默认）/ 详细约 400 字；英文按词计，不硬截断正文 |
| 提炼输出语言 | 中文（默认）、英文或跟随原文 |
| 额外提炼要求 | 高级设置中的内容表达要求，默认空；输出结构始终由插件固定为标题、标签与 Markdown 正文 |
| 历史记录保留数量 | 每个工作区最近 50（默认）/ 100 / 200 次；下调后在下一次成功写操作完成时清理旧记录，不删除便签、画布或未完成记录 |

每组可恢复默认值。开关与选择即时保存，额外要求停止输入 400ms 或失焦时保存；保存失败保留输入，可重试。「测试提炼」使用已保存配置和用户提交的试写文本，会调用模型但不创建便签或操作记录。模型配置只影响「AI 提炼」，普通对话和便签工具继续使用会话模型。

旧 `prompt` 配置不再生效；请使用新的「额外提炼要求」。更改后台插件后需重启 Harness，单独刷新页面不足以更新后台。

## 开发 🛠️

```sh
pnpm install
npm test            # vitest：单元 / API 测试
npx tsc --noEmit    # 类型检查
npm run build       # tsdown 构建：Host 服务 + 客户端 bundle → lib/
```

已安装 Harness 时，可运行 `node test/host-extraction.mjs /path/to/installed/dsh`，用宿主真实 schema 校验器和 Session 对象验证工具注册、范围读取、来源落盘、重复跳过及恢复。脚本只在临时工作区创建测试便签，结束后清理。

`test/browser-*.mjs` 为浏览器端到端脚本，需要本地运行的真实 Harness 实例（默认 3081–3083 端口），认证状态与日志位于 `/tmp`，截图输出至 `artifacts/`（已 gitignore）。客户端代码修改构建后刷新页面即可，Host 侧修改需重启实例。

## 跨平台路径 🌐

工作区 root 支持 macOS / Linux 的 `/path/to/ws` 与 Windows 的 `C:\path\to\ws`、`C:/path/to/ws`、UNC `\\server\share\ws`。实现约定：

- 路径形式判断（是否绝对路径、分隔符、大小写）只允许发生在 `src/workspace-root.mjs`，全仓其余模块拿到的都是规范化后的 root（`test/path-hygiene.test.mjs` 用静态扫描强制这一点）；
- 规范形 = `resolve` + Windows 盘符小写，目录存在时再经 `realpath` 消除符号链接与盘符大小写变体（UNC 服务器名大小写不处理），保证同一工作区共享同一把写队列与同一份操作记录；
- 操作日志（`.noteboard/history/`）中的文件键在所有平台统一为正斜杠的工作区相对路径；
- CI 在 macOS / Ubuntu / Windows 三个平台运行同一套测试（`.github/workflows/ci.yml`）。

## 边界与已知限制 ⚠️

- 不提供连接线（edges）与成组（groups）的 UI，文件格式已为其留位
- 不监听文件变更：切到画布标签或每次 RPC 操作前整体重读
- 单用户假设：无跨进程文件锁、无实时协同
- 底部操作区适配依赖宿主的 DOM 标记与注入接口，宿主升级后需复验，不能仅凭版本号判定兼容
- 画布内不做完整聊天、富文本与通用 Undo/Redo

## 致谢 💛

感谢 **EE** 为本项目提供 Token 赞助，支持了本插件的开发与验证。🙏✨

## 许可 📄

[MIT](./LICENSE)
