<h1 align="center">dsh-noteboard</h1>

<p align="center">中文 | <a href="README.en.md">English</a></p>

<p align="center">
  和 AI 聊得越久，值得留住的东西越多——一个想法、一段结论、一条待办，往往就沉在对话记录里再也翻不到。<br>
  <b>dsh-noteboard</b> 在 DeepSeek Harness（DSH）的会话视图旁加了一块<b>便签画布</b>：看到有用的内容，框选一下就钉成便签；想法攒多了，拖拽、打标签、自动归类；要继续深入时，把便签作为引用发回输入框，让 AI 基于它们接着干活。<br>
  便签都是普通的 Markdown 文件，放在你自己的工作区里。
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license">
  <img src="https://badgen.net/badge/dsh/%3E%3D0.1.2-rc.1/blue" alt="dsh version">
  <img src="https://badgen.net/badge/node/%3E%3D22.19/blue" alt="node version">
</p>

## 效果

**画布总览**

![画布总览](screenshots/canvas-overview.png)

**把便签引用进输入框，发给 AI**

![把便签引用进输入框](screenshots/cite-notes.png)

**在对话里框选文字，生成便签**

![在对话里框选文字，生成便签](screenshots/capture-from-chat.png)

<!-- 截图请放到 screenshots/ 目录：
     - canvas-overview.png —— 画布总览：多张不同颜色的便签 + 分类标题 + 顶部工具栏，体现整体观感
     - cite-notes.png —— 输入态：底部输入框展开，上方挂着 2–3 个便签引用气泡，体现"便签发回给 AI"
     - capture-from-chat.png —— 对话视图中框选一段文字，浮出「存入画布 / AI 提炼」按钮（或已生成的带回链便签） -->

## 能做什么

### 从对话到便签

- 对话里看到值得留住的内容——不管是 AI 的回答还是你自己写的——选中它，点**「存入画布」**原文保存，或点**「AI 提炼」**让模型把这段话浓缩成一张带标题和标签的便签（提炼失败会自动降级为原文保存）
- 每张这样来的便签都带着来源：点「打开对话」跳回它诞生的位置，看完一键回到画布

### 从便签回到对话

- 画布底部的操作区可以展开成输入框，把便签加进去一起发给 AI
- 被引用的便签变成输入框上方的彩色气泡，可预览、可移除；发送时 AI 收到的是便签的完整正文与结构化引用——不用再向它描述「我那张黄色的便签」
- AI 忙的时候发送会自动排队；内容太长（超过 32,000 字符）发送前就会提醒

### 在画布上整理

- 无限画布：拖拽摆放、滚轮缩放、框选整组移动；七种颜色、亮暗两套主题
- 给便签打标签，点标签胶囊，画布只突出这一类；一键按标签自动归类排版——动手排版前会自动备份，随时一键还原
- 画布上可以写自由文本，按标签聚类的分类标题自动生成；都能改、能移、能删
- 东西多了：搜索覆盖标题、正文、标签；不在当前画布上的便签，去便签库里找回
- 同一批便签可以摆出多张画布——「灵感池」「本周精选」各一张，随时切换，互不干扰

### 改坏了也不怕

每一次写操作都有历史记录：哪个文件被改了、改之前什么样，点开就能看，并能恢复到任意一步；后来的修改会被检测到，不会悄悄覆盖。

## 安装

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

## 怎么用

1. 安装并重启后，打开任意会话，视图顶部多了一个**「便签画布」**标签。画布是整个工作区共享的：在哪个会话打开，看到的都是同一批便签。
2. **存**：切回对话，选中一段文字 → 「存入画布」或「AI 提炼」。新便签出现在画布中间附近，带着指向原文的回链。
3. **理**：双击空白处新建便签；单击卡片换色、改标签、编辑（左边写、右边实时预览）；拖动安排位置；工具栏一键按标签重排。
4. **用**：点底部操作区的 AI 助手展开输入框，把要讨论的便签加成引用气泡，补上你的问题，发送。
5. **交给 AI**：直接在对话里说「把这些便签按主题归类一下」——见下一节。

## 让 AI 替你整理

插件注册了 10 个便签工具（查询、创建、修改、加入 / 移除、布局整理、另存画布、历史、恢复），模型会按需调用；你不需要记任何工具名，用自然语言提要求即可。另外内置 4 个工作流，覆盖最常见的整理场景：

| 你可以说 | AI 会做什么 |
| --- | --- |
| 「把这些便签按主题归类一下」 | 识别主题、复用已有标签、重排布局（noteboard-organize） |
| 「比较一下这几张便签里的方案」 | 按共同维度对比，指出分歧，需要时把结论存成新便签（noteboard-compare） |
| 「把这张想法拆成行动项」 | 区分目标、步骤、依赖，生成行动便签并标注依据（noteboard-actions） |
| 「把重复的便签合并掉」 | 识别重复与互补，生成综合便签，原签按你的要求保留或移除（noteboard-synthesize） |

普通操作使用会话当前模型；「AI 提炼」可以用单独配置的模型（见[设置](#设置)）。

## 你的数据在哪里

便签就在你自己的工作区里，不进任何数据库：

```
<workspace>/.noteboard/
├── meta.json                # 当前激活的画布
├── canvases/                # 画布布局（JSON Canvas 格式，Obsidian 能直接打开）
├── notes/                   # 便签本体：一个个 Markdown 文件
└── history/                 # 操作历史
```

- 每张便签是一个带 YAML frontmatter 的 `.md` 文件：标题、颜色、标签、来源一目了然；手动编辑、脚本处理、放进 Git 都可以
- 画布文件只描述「哪张便签摆在哪」；从画布上移除便签只是拿走摆放，文件还在，便签库里随时找回

## 设置

侧栏「设置 → 插件 → 插件配置」中的「便签画布」卡片，配置「AI 提炼」用的模型：

| 选项 | 说明 |
| --- | --- |
| 提炼 Provider | 「AI 提炼」使用的 provider 路由键；留空自动选择第一个可用 provider（默认空） |
| 提炼模型 | 该 provider 下的模型 id；留空选择其第一个模型（默认空） |
| 提炼提示词 | 自定义提炼提示词；留空使用内置提示词（默认空） |

## 开发

```sh
pnpm install
npm test            # vitest：单元 / API 测试
npx tsc --noEmit    # 类型检查
npm run build       # tsdown 构建：Host 服务 + 客户端 bundle → lib/
```

`test/browser-*.mjs` 为浏览器端到端脚本，需要本地运行的真实 Harness 实例（默认 3081–3083 端口），认证状态与日志位于 `/tmp`，截图输出至 `artifacts/`（已 gitignore）。客户端代码修改构建后刷新页面即可，Host 侧修改需重启实例。

## 边界与已知限制

- 不提供连接线（edges）与成组（groups）的 UI，文件格式已为其留位
- 不监听文件变更：切到画布标签或每次操作前整体重读
- 单用户假设：无跨进程文件锁、无实时协同
- 底部操作区适配依赖宿主的 DOM 标记与注入接口，宿主升级后需复验，不能仅凭版本号判定兼容
- 画布内不做完整聊天、富文本与通用 Undo/Redo

## 许可

[MIT](./LICENSE)
