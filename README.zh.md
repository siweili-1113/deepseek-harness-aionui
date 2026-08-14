# DeepSeek Harness for AionUi

[English](README.md) | 中文

通过标准 ACP（Agent Client Protocol），在 AionUi 中将 DeepSeek Harness 用作本地自定义 agent（智能体），并获得流式回答、推理、工具状态和计划展示。

这是一个基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区集成，并非 DeepSeek AI 或 AionUi 官方发布的项目。

## 这个项目是什么

本项目将 [AionUi](https://github.com/iOfficeAI/AionUi) 连接到 DeepSeek Harness 运行时。AionUi 将随附的启动器作为本地子进程启动，然后通过 stdin/stdout 与 Harness 交换以换行分隔的 ACP JSON-RPC 消息。

| 视角 | 角色 |
|---|---|
| AionUi | 可由 AionUi 启动和渲染的自定义 ACP agent。 |
| DeepSeek Harness | 显式启用的 `rich` ACP 输出投影加本地启动器。 |
| GitHub | 保留上游历史并使该集成可复现的公开 fork。 |

它不是安装在 DeepSeek Harness 内部的独立插件。从 AionUi 的角度看，它是一个 agent 集成；从本仓库的代码结构看，它是 ACP 适配器和启动器。

```text
AionUi
  ↕ ACP JSON-RPC over stdio
scripts/aionui-acp.mjs
  ↓
DeepSeek Harness
  ↓ HTTPS
DeepSeek API
```

## 功能

- 在模型响应时流式发送 assistant 文本。
- 将推理（reasoning）作为 ACP thought 更新发送。
- 展示工具调用的开始、完成、失败和结果内容。
- 将 `todo/write` 状态投影为 AionUi 计划更新。
- 保留 Harness 的工具执行、workspace 权限、会话日志、压缩（compaction）、subagent 和工作流。

## 快速开始

### 前置条件

- Node.js 22.19.x，或者 Node.js 24 及更高版本。
- `pnpm`；以下步骤会通过 Corepack 启用它。
- AionUi 和有效的 DeepSeek API key。

### 1. 安装

```sh
git clone --branch aionui https://github.com/siweili-1113/deepseek-harness-aionui.git
cd deepseek-harness-aionui
corepack enable
pnpm install --frozen-lockfile
```

### 2. 添加自定义 agent

在 AionUi 中打开 **Settings → Agents → Add custom Agent**，填写：

```text
Name: DeepSeek Harness
Command: node
Arguments: /absolute/path/to/deepseek-harness-aionui/scripts/aionui-acp.mjs
Environment:
  DEEPSEEK_API_KEY=<your DeepSeek API key>
```

请使用该电脑上 checkout 的真实绝对路径。保持 `Command` 为 `node`；启动器会自行解析仓库内的其他路径，并使 stdout 只承载 ACP 消息。

### 3. 连接并发送提示词

AionUi 的连接测试会启动 ACP 服务器并创建会话，但不会调用模型。发送一条提示词以验证 DeepSeek 凭据和 rich 更新。首次加载依赖可能使第一次启动比后续启动更慢。

## 换电脑

1. 安装 Node.js、Git 和 AionUi。
2. 克隆 `aionui` 分支并运行 `pnpm install --frozen-lockfile`。
3. 在 AionUi 中指向 `scripts/aionui-acp.mjs` 的新绝对路径。
4. 在新电脑上配置有效的 DeepSeek API key。

不要复制 `node_modules`。它包含为该电脑生成且与平台相关的依赖，应由 `pnpm install` 重新创建。

## 本地数据与密钥

| 路径 | 用途 | 是否提交？ |
|---|---|---|
| `node_modules/` | 为该电脑安装的 JavaScript 依赖。 | 否；使用 `pnpm install` 重新生成。 |
| `.env` | 可选的本地环境值，包括凭据。 | 否。 |
| `.sessions/` | 运行时创建的本地 Harness 会话数据。 | 否。 |

绝不要把真实 API key 放入源码、README 示例、commit、issue 或截图。如果 key 已经暴露，请撤销它并创建替代 key。

## 工作原理

DeepSeek Harness 已提供面向自动化的 ACP 服务器。其默认 `committed` 投影发送完整且已提交的回答。本项目添加显式启用的 `rich` 投影，用于流式发送文本与推理增量、工具调用生命周期更新和待办计划。[`scripts/aionui-acp.mjs`](scripts/aionui-acp.mjs) 会以 `rich` 启动源码 ACP 应用，除非环境选择其他值。

该集成使用标准 ACP 更新，而非 AionUi 专用私有协议。[ACP 示例指南](examples/acp-agent/README.md#aionui-custom-agent)负责接入与故障排查细节；[ACP 包 README](packages/acp/acp/README.md)定义协议行为和限制。

## 限制

- AionUi 和此 checkout 必须位于同一台电脑，因为 AionUi 会启动本地子进程。
- ACP 当前只创建新会话；会话浏览、恢复和删除不属于此集成。
- 提示词支持 Harness 桥接层使用的 ACP 基线；非空 MCP 服务器列表和附加目录会被拒绝。
- `rich` 优先保证交互延迟，可能在重试提交前显示提供方的部分输出；要求输出不混入失败尝试的自动化场景应使用 `committed`。

## 上游关系

GitHub fork 身份是一种发布选择，而非运行依赖。它用于保留官方仓库历史、使改动易于检查，并允许纳入上游更新。AionUi 本地安装只需要这个 checkout 及其已安装依赖。

上游项目仍是 DeepSeek Harness 通用文档、版本发布、社区支持和贡献规则的来源。此 fork 保留上游 MIT 许可证和署名。

<a id="run"></a>

### 运行上游 Web UI

如果需要运行已发布的独立 Harness Web UI，而不是此源码集成：

```sh
npx @deepseek-ai/dsh web
```

<a id="run-from-source"></a>

### 从源码运行上游项目

如需不含此集成的干净 checkout，请使用官方仓库：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## 开发

运行覆盖此集成的聚焦检查：

```sh
pnpm exec vitest run packages/acp/acp/tests --coverage --coverage.include='packages/acp/acp/src/index.ts'
pnpm exec vitest run --config vitest.snapshot.config.ts -t todo-write
pnpm run doc-sync
pnpm run lint
pnpm run build
```

设计与实现资料：

- [ACP rich 输出决策](.agents/notes/implemented/feature/2026-08-14-acp-rich-output-projection.md)
- [ACP 示例与 AionUi 设置](examples/acp-agent/README.md#aionui-custom-agent)
- [ACP 传输包](packages/acp/acp/README.md)
- [DeepSeek Harness 架构](docs/architecture.md)

## 许可证

[MIT](LICENSE)。第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
