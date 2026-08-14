# DeepSeek Harness 的 AionUi 集成版

把 DeepSeek Harness 接入 AionUi，在 AionUi 的聊天界面里使用 DeepSeek 模型、Harness 工具和智能体能力，并实时看到回答、推理过程、工具状态与任务计划。

这是一个基于 [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness)制作的社区集成项目，不是 DeepSeek AI 或 AionUi 官方发布的软件。项目保留了官方仓库的完整代码和历史，并增加了 AionUi 所需的 ACP 交互适配。

> 如果你不熟悉编程，可以这样理解：AionUi 负责聊天界面，DeepSeek Harness 负责调用模型和执行工具，这个项目负责让两边能够正确沟通。

## 先说结论：这个项目到底是什么

它不是一个需要安装进 DeepSeek Harness 插件目录的小文件，也不是一个独立的聊天软件。它是一份已经加入 AionUi 适配能力的 DeepSeek Harness 完整源码，里面包含一个专门的启动器和一组 ACP 输出增强。

从不同角度看，它有不同的称呼：

| 从谁的角度看 | 它是什么 |
|---|---|
| AionUi | 一个可以添加并启动的“自定义 ACP 智能体” |
| DeepSeek Harness | 一套 `rich` ACP 输出适配和一个本地启动器 |
| 普通用户 | 让 AionUi 能更完整使用 DeepSeek Harness 的连接程序 |
| GitHub | DeepSeek Harness 官方仓库的公开 Fork，保留上游代码历史 |

所以，日常交流时把它叫作“DeepSeek Harness 的 AionUi 插件”并没有大问题，因为它确实在做适配接入；但从安装方式和代码结构上说，“AionUi 集成版”或“ACP 适配层”更准确。你不需要先安装一份官方 DeepSeek Harness，再把这个项目复制进去。克隆本仓库、安装依赖，然后让 AionUi 启动本仓库里的脚本即可。

## 它解决了什么问题

AionUi 是图形聊天界面，DeepSeek Harness 是智能体运行环境。两者都支持 ACP（Agent Client Protocol），但“都支持 ACP”不代表直接连接后就一定拥有完整的交互体验。

DeepSeek Harness 原有的 ACP 输出主要服务自动化程序，默认使用 `committed` 模式：等待一段回答正式提交后，再把完整内容交给客户端。这适合程序调用，却不适合聊天界面，因为用户更希望边生成边看到内容，也希望知道智能体正在思考、调用什么工具、任务进行到了哪一步。

本项目增加了 `rich` 模式，把 Harness 内部发生的事件转换成 AionUi 能显示的标准 ACP 更新：

- 模型生成一段文字，AionUi 就能逐步显示，而不是一直等待最终答案。
- Harness 产生推理内容时，AionUi 能收到思考更新。
- Harness 开始、完成或调用工具失败时，AionUi 能显示相应状态和结果。
- Harness 使用 `todo/write` 管理任务时，AionUi 能显示计划变化。

如果没有本项目，AionUi 不会自动知道如何启动你电脑上的 DeepSeek Harness。即使你手动把官方 ACP 示例接入 AionUi，默认也主要得到面向自动化的完整回答，不会自动获得这里的流式文字、推理、工具生命周期和计划展示。你可以自己重新开发这些适配，也可以直接使用本项目已经完成的实现。

## 它是怎样工作的

AionUi 与 DeepSeek Harness 之间的通信发生在你的电脑上，模型请求通过 HTTPS 发送到 DeepSeek API。智能体调用联网工具时，相应工具也可能访问网络：

```text
你在 AionUi 中输入任务
          ↓
AionUi 启动本地自定义智能体
          ↓
scripts/aionui-acp.mjs 启动器
          ↓  通过 stdin/stdout 交换 ACP JSON-RPC 消息
DeepSeek Harness 运行智能体、工具和工作流
          ↓  通过 HTTPS 调用模型
DeepSeek API
```

AionUi 并不是把这个项目“安装到自己内部”。它会像启动普通命令一样，在本机启动 `scripts/aionui-acp.mjs`。这个脚本再启动 DeepSeek Harness 的 ACP 服务，并默认选择 `rich` 输出模式。双方通过标准输入和标准输出交换一行一条的 JSON-RPC 消息，因此启动器必须把普通日志写到标准错误，不能把调试文字混入 ACP 消息。

## 这个 Fork 具体增加了什么

相对于上游 DeepSeek Harness，本项目主要增加和调整了以下内容：

1. 为 ACP 服务增加可选的 `rich` 输出模式，同时保留原有 `committed` 模式。
2. 将流式回答、推理增量、工具调用开始/完成/失败和工具结果转换为标准 ACP 更新。
3. 将 Harness 的 `todo/write` 状态转换为 AionUi 可以展示的计划更新。
4. 增加 [`scripts/aionui-acp.mjs`](scripts/aionui-acp.mjs)，让 AionUi 只需执行一条稳定的本地命令。
5. 增加对应测试、快照、说明文档和运行检查，避免后续更新悄悄破坏接入效果。

Harness 原有的工具执行、工作区权限、会话日志、上下文压缩、子智能体和工作流仍然存在。本项目不是重新制作一个简化版 Harness，而是在完整 Harness 上增加交互客户端需要的输出方式。

## 你会遇到的几个名词

### ACP 是什么

ACP 全称 Agent Client Protocol，可以理解成“聊天界面和智能体程序之间的通用通信规则”。AionUi 按这个规则发送新建会话、用户消息和取消任务等请求；DeepSeek Harness 按同一规则返回回答、推理、工具状态和计划。因为使用的是标准 ACP，而不是只给 AionUi 使用的私有协议，其他兼容客户端原则上也可以使用这套输出。

### Node.js 是什么

这个项目的大部分代码使用 TypeScript 和 JavaScript 编写，Node.js 是运行这些代码的基础环境。AionUi 配置里的 `Command: node`，意思就是“请使用 Node.js 执行后面的启动脚本”。没有安装正确版本的 Node.js，启动器就无法运行。

### pnpm 是什么

`pnpm` 是这个项目使用的依赖管理工具。它会读取 `package.json` 和 `pnpm-lock.yaml`，下载项目需要的第三方代码，并按锁定版本安装。你通常不需要理解每个依赖，只需要在首次安装、切换电脑或项目依赖更新后运行安装命令。

### `node_modules` 是什么，为什么这么大

`node_modules` 是 `pnpm install` 生成的依赖目录，里面不是你编写的项目源码，而是 DeepSeek Harness 运行、构建和测试所需的第三方 JavaScript 包。这个仓库包含很多工作区和开发工具，因此依赖数量多、目录看起来很大是正常现象。

它不需要上传到 GitHub，仓库已经通过 `.gitignore` 忽略它；也不需要在换电脑时复制。新电脑运行 `pnpm install --frozen-lockfile` 就能按照锁定版本重新生成。删除它不会删除你在 GitHub 上的源码，但再次运行项目前需要重新安装依赖。

## 当前可以获得的效果

- 在 AionUi 中逐步显示 DeepSeek 的回答。
- 显示模型推理更新，具体呈现方式由 AionUi 决定。
- 显示工具调用的开始、运行结果、完成和失败状态。
- 把 Harness 任务清单显示成 AionUi 计划。
- 使用 Harness 自带的文件、Shell、工作流、子智能体等能力，实际可用工具取决于当前配置和权限。
- 由 AionUi 启动和关闭本地进程，不需要单独常驻一个服务器。

## 安装前准备

你需要准备：

- [AionUi](https://github.com/iOfficeAI/AionUi)。
- Git，用来从 GitHub 下载和更新项目。
- Node.js 22.19.x，或者 Node.js 24 及更高版本。
- 有效的 DeepSeek API Key，用来调用 DeepSeek 模型。
- 能够访问 GitHub 和软件依赖源的网络环境。

可以在终端检查基础工具是否已经安装：

```sh
git --version
node --version
corepack --version
```

如果这些命令能输出版本号，说明对应工具可以使用。Node.js 版本不符合要求时，请先升级 Node.js。

## 安装步骤

### 第一步：下载项目

在终端依次运行：

```sh
git clone --branch aionui https://github.com/siweili-1113/deepseek-harness-aionui.git
cd deepseek-harness-aionui
```

第一条命令从 GitHub 下载本项目的 `aionui` 产品分支；第二条命令进入刚下载的项目目录。以后不要随意移动这个目录，否则 AionUi 中保存的绝对路径会失效。

### 第二步：启用 pnpm

```sh
corepack enable
pnpm --version
```

Corepack 随 Node.js 提供，用来启用项目指定版本的 pnpm。第二条命令用于确认 pnpm 可以正常运行。

### 第三步：安装依赖

```sh
pnpm install --frozen-lockfile
```

这条命令会根据仓库锁定的版本安装依赖，并生成 `node_modules`。`--frozen-lockfile` 表示严格使用仓库记录的依赖版本，不擅自改写锁文件，适合普通使用者和换电脑恢复环境。

首次安装需要下载较多内容，耗时取决于网络和电脑性能。安装完成后，项目源码仍在当前目录，依赖则位于本机的 pnpm 存储和 `node_modules` 连接结构中。

## 在 AionUi 中配置

打开 AionUi，进入 **Settings → Agents → Add custom Agent**。不同版本的中文翻译可能略有差异，对应含义是“设置 → 智能体 → 添加自定义智能体”。

填写以下内容：

```text
Name: DeepSeek Harness
Command: node
Arguments: /你的绝对路径/deepseek-harness-aionui/scripts/aionui-acp.mjs
Environment:
  DEEPSEEK_API_KEY=<你的 DeepSeek API Key>
```

各字段的作用如下：

| 字段 | 填什么 | 为什么 |
|---|---|---|
| `Name` | `DeepSeek Harness`，也可以改成你喜欢的名字 | 只影响 AionUi 中显示的名称 |
| `Command` | `node` | 使用 Node.js 运行启动器 |
| `Arguments` | `scripts/aionui-acp.mjs` 的真实绝对路径 | 告诉 Node.js 要执行哪个文件 |
| `Environment` | `DEEPSEEK_API_KEY` 和你的有效 Key | 让 Harness 有权限调用 DeepSeek API |

绝对路径必须从磁盘根目录开始，不能直接填 `scripts/aionui-acp.mjs`。例如 macOS 路径可能是：

```text
/Users/你的用户名/Downloads/deepseek-harness-aionui/scripts/aionui-acp.mjs
```

保存后先运行 AionUi 的连接测试。连接测试只会启动 ACP 服务并创建会话，不一定会调用模型；因此“连接成功”只能说明 Node.js、路径和 ACP 启动基本正常。接着发送一条真实消息，才能同时验证 API Key、网络、模型调用和 rich 输出。

第一次启动需要加载较多依赖，可能比之后启动更慢。

## DeepSeek API Key 怎么保存

推荐把 Key 放在 AionUi 自定义智能体的环境变量配置中，变量名必须是 `DEEPSEEK_API_KEY`。不要把真实 Key 写进 README、源码、Git 提交、Issue、聊天截图或任何准备公开上传的文件。

本项目不会把示例中的占位文本当作有效 Key。Key 一旦在公开位置出现，即使很快删除，也应当立即去 DeepSeek 平台撤销旧 Key 并创建一个新 Key，因为 Git 历史、通知或缓存中仍可能保留原内容。

## 换一台电脑怎么恢复

这个项目适合通过 GitHub 迁移，不需要复制整个旧目录：

1. 在新电脑安装 Git、正确版本的 Node.js 和 AionUi。
2. 重新运行本页的克隆、`corepack enable` 和 `pnpm install --frozen-lockfile` 命令。
3. 在新电脑的 AionUi 中重新添加自定义智能体。
4. 把 `Arguments` 改成新电脑上的真实绝对路径。
5. 在新电脑重新配置有效的 `DEEPSEEK_API_KEY`。
6. 先做连接测试，再发送一条真实消息验证模型调用。

不需要迁移 `node_modules`，因为它体积大、可以重新生成，而且某些依赖与操作系统和 CPU 架构有关。也不要把 API Key 提交到 GitHub 来“方便同步”。

如果需要保留本地会话，应单独备份 `.sessions/`，但当前 AionUi ACP 集成主要创建新会话，不提供完整的会话浏览、恢复和删除功能。普通迁移只克隆 GitHub 仓库不会自动带走旧电脑上的本地会话。

## 日常更新

项目后续更新后，可以在项目目录运行：

```sh
git pull --ff-only
pnpm install --frozen-lockfile
```

第一条命令获取 `aionui` 分支的新提交；第二条命令让本机依赖与最新锁文件保持一致。只要项目目录没有移动，AionUi 中的脚本路径通常不需要修改。

## 哪些内容在 GitHub，哪些只在本机

| 文件或目录 | 用途 | 是否应上传 GitHub |
|---|---|---|
| 项目源码、测试和文档 | 构成这个 AionUi 集成项目 | 是 |
| `pnpm-lock.yaml` | 锁定所有人使用的依赖版本 | 是 |
| `node_modules/` | 当前电脑安装的第三方依赖 | 否，可重新生成 |
| `.env` | 可选的本地环境变量和密钥 | 否 |
| `.sessions/` | 当前电脑产生的 Harness 会话数据 | 否 |
| AionUi 本地设置 | 保存自定义智能体命令、路径和环境变量 | 否，需要在新电脑重新配置 |

GitHub 上保存的是“可以重建项目的源码和版本记录”，不是你电脑上运行后的所有文件。换电脑时，Git 负责恢复源码，pnpm 负责恢复依赖，AionUi 负责保存当前电脑的界面配置，而 API Key 需要安全地重新填写。

## 常见问题

### AionUi 提示无法启动或找不到文件

先确认 `Arguments` 使用绝对路径，并且该路径下确实存在 `scripts/aionui-acp.mjs`。如果移动或重命名了项目目录，需要同步修改 AionUi 配置。还可以在终端运行 `node --version`，确认 AionUi 所在系统能够找到 Node.js。

### 连接测试成功，但发送消息失败

连接测试不会完整验证模型调用。请检查 `DEEPSEEK_API_KEY` 是否正确、是否仍然有效，电脑能否访问 DeepSeek API，以及环境变量名有没有拼错。不要把真实 Key 发到公开 Issue 中排查。

### 启动时出现找不到模块或依赖的错误

在项目根目录重新运行：

```sh
pnpm install --frozen-lockfile
```

同时确认当前 Node.js 版本满足要求。不要从另一台电脑直接复制 `node_modules` 来修复依赖问题。

### AionUi 收到奇怪的 JSON 错误

ACP 使用标准输出传输 JSON-RPC。请直接让 AionUi 执行 `node` 和启动器路径，不要在外面再套一层会向标准输出打印欢迎语或调试日志的 Shell 脚本，否则普通文字会污染协议消息。

### 为什么看不到推理、工具或计划

这些内容只有在模型或 Harness 实际产生对应事件时才会出现，并且最终显示方式取决于 AionUi 版本。确认 AionUi 启动的是本仓库的 `scripts/aionui-acp.mjs`，且没有通过环境变量把 `DSH_ACP_OUTPUT` 改成 `committed`。

### 可以删除 `node_modules` 吗

可以，但删除后项目暂时无法正常启动，需要重新运行 `pnpm install --frozen-lockfile`。它是可重建的依赖，不是你的源码，也不应提交到 GitHub。

### 这是官方项目吗

不是。这是社区维护的公开 Fork。DeepSeek Harness 的基础代码来自 DeepSeek AI 官方仓库，AionUi 接入部分由本 Fork 提供。遇到本项目特有的 AionUi 连接问题，请在本仓库反馈；上游 Harness 的通用问题和 AionUi 自身问题应分别参考对应官方项目。

## 当前限制

- AionUi 和本仓库必须在同一台电脑上，因为 AionUi 启动的是本地子进程。
- ACP 当前创建新会话；完整的会话浏览、恢复和删除不在这次集成范围内。
- 当前桥接支持 Harness 使用的 ACP 基础提示请求；非空 MCP 服务器列表和额外目录会被拒绝。
- `rich` 模式优先提供即时反馈。在模型提供方发生重试时，界面可能已经显示失败尝试产生的部分内容；要求只接收最终提交内容的自动化程序应使用 `committed` 模式。
- 这是源码安装方式，不是点击一次即可安装的 AionUi 应用商店插件；首次使用需要安装 Node.js 和项目依赖。

## 为什么保留 Fork 身份

Fork 只是 GitHub 上的代码来源关系，不影响本地运行。保留 Fork 身份有几个实际用途：任何人都能确认基础代码来自哪个官方仓库、查看本项目改了什么，并在需要时同步 DeepSeek Harness 上游更新。

对普通使用者来说，不需要理解 Git 分支合并。只需要克隆本仓库默认的 `aionui` 分支即可。对维护者来说，`upstream` 指向官方 DeepSeek Harness，`origin` 指向这个公开集成仓库，两边的关系使长期维护更清楚。

## 进一步了解

- [AionUi 自定义智能体接入说明](examples/acp-agent/README.md#aionui-custom-agent)：更接近代码维护者的接入与排错说明。
- [ACP 包说明](packages/acp/acp/README.md)：`committed` 和 `rich` 输出的协议行为与限制。
- [DeepSeek Harness 架构](docs/architecture.md)：Harness 的插件架构、核心组件和扩展方式。
- [本项目的 rich 输出设计记录](.agents/notes/implemented/feature/2026-08-14-acp-rich-output-projection.md)：为什么这样设计以及如何验证。

<a id="run"></a>

## 运行上游独立 Web 界面

如果你想运行 DeepSeek Harness 自带的 Web 界面，而不是把它接入 AionUi，可以执行官方发布包：

```sh
npx @deepseek-ai/dsh web
```

这个入口和 AionUi 集成是两种不同的使用方式：前者使用 Harness 自带界面，后者让 AionUi 启动本仓库的 ACP 智能体。

<a id="run-from-source"></a>

## 从官方源码运行原版项目

如果你需要一份不包含本 Fork 接入改动的官方 DeepSeek Harness，请使用上游仓库：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## 开发和验证

这一部分面向准备修改代码的人。覆盖本集成的主要检查如下：

```sh
pnpm exec vitest run packages/acp/acp/tests --coverage --coverage.include='packages/acp/acp/src/index.ts'
pnpm exec vitest run --config vitest.snapshot.config.ts -t todo-write
pnpm run doc-sync
pnpm run lint
pnpm run build
```

修改代码前请先阅读 [`AGENTS.md`](AGENTS.md) 和 [`docs/architecture.md`](docs/architecture.md)，并根据变更范围运行相应测试。

## 许可证

本项目使用 [MIT 许可证](LICENSE)。第三方依赖及其许可证见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
