# acp-agent 示例

[English](README.md) | 中文

通过 JSON-RPC stdio 提供的 [ACP（Agent Client Protocol）](https://agentclientprotocol.com) 服务器。Committed 输出服务于 parent agent（父智能体）、subagent 提供方和其他程序化客户端；显式启用的 rich 投影服务于兼容的交互式客户端。

```sh
pnpm run demo:acp             # needs DEEPSEEK_API_KEY (repo-root .env or env)
pnpm run demo:code-mode       # same protocol with the Code Mode tool transport
```

该叶节点加载 ACP 应用、DeepSeek 适配器、受沙箱限制的 bash 与文件系统栈、一次性批准策略、压缩（compaction）、subagent、工作流、钩子、派生会话查询索引和重复守卫。应用为每次 `session/new` 创建一个新 agent，将会话持久化到 JSONL，并保持 stdout 只含协议内容。可选 overlay 可添加会话查询、文件系统 spill 存储、Code Mode 或 Web 抓取。

## 协议通道

Stdout 只携带以换行分隔的 ACP JSON-RPC。`@deepseek-ai/dsh-acp-demo` 不安装 stdout logger；该叶节点新增的组件必须使用 stderr 输出诊断信息。

协议约定（支持的方法、基线提示词内容、输出投影，以及有意缺少的 UI 界面）位于 [`@deepseek-ai/dsh-acp`](../../packages/acp/acp/README.md)。

## AionUi 自定义 Agent

使用 Node.js 22.19 或更高版本，并在本 checkout 中安装依赖：

```sh
pnpm install
```

在 AionUi 中打开 **Settings → Agents → Add custom Agent**，填写：

```text
Name: DeepSeek Harness
Command: node
Arguments: /absolute/path/to/deepseek-harness/scripts/aionui-acp.mjs
Environment:
  DEEPSEEK_API_KEY=<your key>
```

除非环境已经选择其他投影，启动器会设置 `DSH_ACP_OUTPUT=rich`。AionUi 随后通过标准 ACP 更新接收实时 assistant 文本、推理、工具调用状态和待办计划。连接测试会执行 `initialize` 和 `session/new`；发送第一条提示词还需要有效的 DeepSeek 凭据。

请直接运行 `node scripts/aionui-acp.mjs`。如果外层命令向 stdout 写入诊断信息，可能破坏以换行分隔的 JSON-RPC 数据流。该 checkout 与 AionUi 必须位于同一台电脑，因为自定义 agent 是本地子进程。

## 会话 workspace 与权限

每次 `session/new` 都提供一个绝对 `cwd`。受沙箱限制的 bash 和文件系统修改会以该会话 cwd 为基准应用 `workspace-write`，因此并发会话可以使用不同的项目根目录；平台临时根目录仍是共享可写暂存空间（参见[沙箱约定](../../packages/sandbox/sandbox/README.md)）。`DSH_PERMISSION_MODE` 为部署选择 `workspace-write` 或 `danger-full-access`。

在 `workspace-write` 下，如果模型重试请求更广泛的沙箱访问权限，就会触发 `session/request_permission`，选项为 `allow_once` 和 `reject_once`。客户端通过 ACP 决策；客户端放弃选择或无法给出答复时，系统会按拒绝处理。选定结果仅适用于该次重试，并通过常规工具结果／审计路径记录。服务器绝不持久化客户端策略。
