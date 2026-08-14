# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## AionUi 集成 fork

这个公开 fork 为 DeepSeek Harness 添加了 [AionUi](https://github.com/iOfficeAI/AionUi) 集成。AionUi 将 Harness 作为自定义 ACP（Agent Client Protocol）agent 启动，并通过 stdin/stdout 上以换行分隔的 JSON-RPC 与其通信。

它不是安装在 DeepSeek Harness 内部的独立插件。该实现为 Harness 现有的 ACP 传输层增加了显式启用的 `rich` 输出投影，并提供 [`scripts/aionui-acp.mjs`](scripts/aionui-acp.mjs) 作为由 AionUi 执行的本地启动器。从 AionUi 的角度看，它是一个 ACP agent 集成；从本仓库的代码结构看，它是 ACP 适配器加启动器。

该集成让 AionUi 获得：

- 流式 assistant 文本与推理（reasoning）；
- 工具调用开始、完成和失败更新；
- 将 `todo/write` 状态作为 ACP 计划更新；
- Harness 原有的工具执行、workspace 权限、会话日志和 DeepSeek 模型访问。

默认的 `committed` ACP 投影仍供自动化客户端使用。AionUi 启动器会选择 `rich` 输出，使界面可以在 agent 轮次运行时显示进度。

### 接入 AionUi

安装 Node.js 22.19 或更高版本，然后克隆此集成分支并安装依赖：

```sh
git clone --branch codex/aionui-acp-bridge git@github.com:siweili-1113/deepseek-harness.git
cd deepseek-harness
corepack enable
pnpm install --frozen-lockfile
```

在 AionUi 中打开 **Settings → Agents → Add custom Agent**，填写：

```text
Name: DeepSeek Harness
Command: node
Arguments: /absolute/path/to/deepseek-harness/scripts/aionui-acp.mjs
Environment:
  DEEPSEEK_API_KEY=<your DeepSeek API key>
```

连接测试会启动 ACP 服务器，但不会调用模型。发送第一条提示词时需要有效的 DeepSeek API key。请把 key 保存在 AionUi 的环境配置或本地 `.env` 中，绝不要提交它。

换电脑时，只需克隆同一分支、运行 `pnpm install --frozen-lockfile`、在 AionUi 中更新启动器的绝对路径，并重新配置 API key。不要复制 `node_modules`；`pnpm install` 会为该电脑重新生成它。协议和故障排查细节见 [ACP 示例指南](examples/acp-agent/README.md#aionui-custom-agent)。

### 为什么使用 fork

GitHub fork 身份不是运行依赖。它用于保留与 DeepSeek Harness 官方仓库的关系，方便比较改动、向上游贡献，以及以后纳入官方更新。AionUi 的本地安装只需要这个 checkout 及其依赖。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
