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

## 功能

### 画布

- 工作区级无限画布，以会话视图标签页呈现；布局可保存为多个画布，同一便签可出现在不同画布
- 平移、缩放（0.2×–3×）、空白框选、整组拖动、网格吸附
- 便签卡片固定宽度，受限 Markdown 渲染；七种颜色，亮暗双主题
- 自由文本节点与按标签自动生成的分类标题，均可编辑、移动、删除；分类标题支持抑制与重新生成
- 搜索覆盖标题、正文、标签；便签库列出不在当前画布的便签并可找回
- 按标签自动重排（聚簇装箱）；重排前自动备份布局，可一键恢复
- 视口按工作区与画布记忆

### 编辑

- 单击卡片弹出操作条：换色、标签增删、编辑、来源回链、从画布移除
- 居中模态编辑器，实时预览完整 Markdown；保存失败保留草稿
- 从画布移除仅删除布局节点，便签文件保留

### 对话采集

- 对话区框选文字：「存入画布」原文保存，不经模型；「AI 提炼」由 Host 侧调用 LLM 生成标题、标签与正文，不经对话流，失败降级为原文保存
- 采集的便签记录来源回链（sessionId 与可读 label），可跳转回对话中原文位置并返回画布

### 便签引用

- 底部操作区双态切换（工具态 / 输入态），复用宿主输入框
- 便签以引用气泡加入输入框，可预览、单张或整组移除；发送时携带便签正文与结构化引用
- 发送内容累计超过 32,000 字符时阻止；AI 运行中发送自动排队
- 画布激活期间新完成的 AI 回复显示通知，可跳转对话

### 历史与恢复

- 全部写操作记录于 `.noteboard/history/`，可查看文件修改前后全文
- 支持恢复到指定操作；检测后续修改，冲突时拒绝覆盖

## 效果

**画布总览**

![画布总览](screenshots/canvas-overview.png)

**便签引用输入**

![便签引用输入](screenshots/cite-notes.png)

**从对话采集便签**

![从对话采集便签](screenshots/capture-from-chat.png)

<!-- 截图请放到 screenshots/ 目录：
     - canvas-overview.png —— 画布总览：多张不同颜色的便签 + 分类标题 + 顶部工具栏
     - cite-notes.png —— 输入态：底部输入框展开，上方挂着 2–3 个便签引用气泡
     - capture-from-chat.png —— 对话视图中框选一段文字，浮出「存入画布 / AI 提炼」按钮 -->

## AI 工具与工作流

随插件注册 10 个模型工具：

| 工具 | 说明 |
| --- | --- |
| `canvas_add_note` | 创建一张便签放入指定画布，可记录 `derivedFrom` 依据 |
| `noteboard_query` | 搜索工作区便签，或按 ids 读取全文、版本与来源 |
| `noteboard_create` | 批量创建便签（单次最多 200 张） |
| `noteboard_update` | 修改便签（须携带读取时版本）；内容修改影响所有画布 |
| `noteboard_add` | 把已有便签放入指定画布，不复制文件 |
| `noteboard_remove` | 仅从指定画布移除便签，保留文件 |
| `noteboard_layout` | 重排、对齐、分布指定便签（须携带画布版本） |
| `noteboard_save_as` | 另存画布布局 |
| `noteboard_history` | 列出操作记录，可查看文件修改前后全文 |
| `noteboard_restore` | 恢复指定操作，检测后续修改冲突并拒绝覆盖 |

以及 4 个内置工作流（Skill）：

| 工作流 | 说明 |
| --- | --- |
| `noteboard-organize` | 按主题归类、加标签、整理便签布局 |
| `noteboard-compare` | 比较便签中的方案、权衡优缺点、识别分歧 |
| `noteboard-actions` | 把便签中的想法拆解为行动项或实施步骤 |
| `noteboard-synthesize` | 合并重复便签、去重或综合多个结论 |

普通操作使用会话模型；「AI 提炼」的模型在插件设置中单独配置。

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

## 数据格式

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

## 设置

侧栏「设置 → 插件 → 插件配置」中的「便签画布」卡片：

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
- 不监听文件变更：切到画布标签或每次 RPC 操作前整体重读
- 单用户假设：无跨进程文件锁、无实时协同
- 底部操作区适配依赖宿主的 DOM 标记与注入接口，宿主升级后需复验，不能仅凭版本号判定兼容
- 画布内不做完整聊天、富文本与通用 Undo/Redo

## 许可

[MIT](./LICENSE)
