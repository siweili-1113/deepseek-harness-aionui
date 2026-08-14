# acp-agent example

English | [中文](README.zh.md)

[Agent Client Protocol](https://agentclientprotocol.com) server over JSON-RPC stdio. Committed output serves parent agents, subagent providers, and other programmatic clients; an explicit rich projection serves compatible interactive clients.

```sh
pnpm run demo:acp             # needs DEEPSEEK_API_KEY (repo-root .env or env)
pnpm run demo:code-mode       # same protocol with the Code Mode tool transport
```

The leaf loads the ACP app, DeepSeek adapter, sandboxed bash and filesystem stacks, one-shot approval policy, compaction, subagents, workflows, hooks, a derived session-query index, and repeat guard. The app creates one fresh agent per `session/new`, persists sessions to JSONL, and keeps stdout protocol-pure. Optional overlays add session queries, filesystem spill storage, Code Mode, or web fetching.

## Protocol channel

Stdout carries only newline-delimited ACP JSON-RPC. `@deepseek-ai/dsh-acp-demo` installs no stdout logger; leaf additions must use stderr for diagnostics.

The protocol contract — supported methods, baseline prompt content, output projections, and the intentionally absent UI surfaces — lives in [`@deepseek-ai/dsh-acp`](../../packages/acp/acp/README.md).

## AionUi custom agent

Install dependencies in this checkout with Node.js 22.19 or newer:

```sh
pnpm install
```

In AionUi, open **Settings → Agents → Add custom Agent** and configure:

```text
Name: DeepSeek Harness
Command: node
Arguments: /absolute/path/to/deepseek-harness/scripts/aionui-acp.mjs
Environment:
  DEEPSEEK_API_KEY=<your key>
```

The launcher sets `DSH_ACP_OUTPUT=rich` unless the environment already selects another projection. AionUi then receives live assistant text, reasoning, tool-call status, and todo plans through standard ACP updates. Its connection test exercises `initialize` and `session/new`; the first prompt additionally requires a valid DeepSeek credential.

Run `node scripts/aionui-acp.mjs` directly. Wrapping the launcher in a command that writes diagnostics to stdout can corrupt the newline-delimited JSON-RPC stream. The checkout and AionUi must be on the same computer because the custom agent is a local child process.

## Session workspaces and permissions

Each `session/new` supplies an absolute `cwd`. Sandboxed bash and filesystem mutations resolve `workspace-write` against that session cwd, so concurrent sessions can use separate project roots; platform temporary roots remain shared writable scratch space ([sandbox contract](../../packages/sandbox/sandbox/README.md)). `DSH_PERMISSION_MODE` selects `workspace-write` or `danger-full-access` for the deployment.

Under `workspace-write`, a model retry requesting wider sandbox access triggers `session/request_permission` with `allow_once` and `reject_once`. The client decides through ACP; dismissal or an unavailable answer fails closed. The selected outcome applies only to that retry and is recorded through the normal tool-result/audit path. The server never persists client policy.
