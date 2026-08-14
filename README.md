# DeepSeek Harness for AionUi

English | [中文](README.zh.md)

Use DeepSeek Harness as a local custom agent in AionUi, with streamed answers, reasoning, tool status, and plans over the standard Agent Client Protocol.

This is a community integration built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It is not an official DeepSeek AI or AionUi release.

## What this project is

This project connects [AionUi](https://github.com/iOfficeAI/AionUi) to the DeepSeek Harness runtime. AionUi starts the bundled launcher as a local child process, then exchanges newline-delimited ACP JSON-RPC messages with Harness over stdin/stdout.

| Perspective | Role |
|---|---|
| AionUi | A custom ACP agent that AionUi can start and render. |
| DeepSeek Harness | An opt-in `rich` ACP output projection plus a local launcher. |
| GitHub | A public fork that preserves upstream history and makes the integration reproducible. |

It is not a standalone plugin installed inside DeepSeek Harness. From AionUi's perspective it behaves like an agent integration; inside this repository it is an ACP adapter and launcher.

```text
AionUi
  ↕ ACP JSON-RPC over stdio
scripts/aionui-acp.mjs
  ↓
DeepSeek Harness
  ↓ HTTPS
DeepSeek API
```

## Features

- Streams assistant text while the model is responding.
- Sends reasoning as ACP thought updates.
- Shows tool-call start, completion, failure, and result content.
- Projects `todo/write` state as AionUi plan updates.
- Keeps Harness tool execution, workspace permissions, session logging, compaction, subagents, and workflows available.

## Quick start

### Prerequisites

- Node.js 22.19.x or Node.js 24 and newer.
- `pnpm`, enabled through Corepack in the steps below.
- AionUi and a valid DeepSeek API key.

### 1. Install

```sh
git clone --branch aionui https://github.com/siweili-1113/deepseek-harness-aionui.git
cd deepseek-harness-aionui
corepack enable
pnpm install --frozen-lockfile
```

### 2. Add the custom agent

In AionUi, open **Settings → Agents → Add custom Agent** and enter:

```text
Name: DeepSeek Harness
Command: node
Arguments: /absolute/path/to/deepseek-harness-aionui/scripts/aionui-acp.mjs
Environment:
  DEEPSEEK_API_KEY=<your DeepSeek API key>
```

Use the actual absolute checkout path on your computer. Keep `Command` as `node`; the launcher resolves every other repository path itself and reserves stdout for ACP messages.

### 3. Connect and prompt

AionUi's connection test starts the ACP server and creates a session without calling the model. Send a prompt to verify the DeepSeek credential and rich updates. The first dependency load can make the initial startup slower than later launches.

## Move to another computer

1. Install Node.js, Git, and AionUi.
2. Clone the `aionui` branch and run `pnpm install --frozen-lockfile`.
3. Point AionUi to the new absolute path of `scripts/aionui-acp.mjs`.
4. Configure a valid DeepSeek API key on the new computer.

Do not copy `node_modules`. It contains generated, platform-dependent dependencies and is recreated by `pnpm install`.

## Local data and secrets

| Path | Purpose | Commit it? |
|---|---|---|
| `node_modules/` | Installed JavaScript dependencies for this computer. | No; regenerate it with `pnpm install`. |
| `.env` | Optional local environment values, including credentials. | No. |
| `.sessions/` | Local Harness session data created while running. | No. |

Never place a real API key in source, README examples, commits, issues, or screenshots. If a key is exposed, revoke it and create a replacement.

## How it works

DeepSeek Harness already provides an ACP server for automation. Its default `committed` projection sends complete committed answers. This project adds an explicit `rich` projection that streams text and reasoning deltas, tool-call lifecycle updates, and todo plans. [`scripts/aionui-acp.mjs`](scripts/aionui-acp.mjs) starts the source ACP application with `rich` selected unless the environment overrides it.

The integration uses standard ACP updates rather than an AionUi-specific private protocol. The [ACP example guide](examples/acp-agent/README.md#aionui-custom-agent) owns setup and troubleshooting details; the [ACP package README](packages/acp/acp/README.md) defines protocol behavior and limitations.

## Limitations

- AionUi and this checkout must be on the same computer because AionUi starts a local child process.
- ACP currently creates fresh sessions; session browsing, resume, and deletion remain outside this integration.
- Prompts support the ACP baseline used by the Harness bridge; non-empty MCP server lists and additional directories reject.
- `rich` favors interactive latency and can show partial provider output before a retry commits; automation that requires attempt-clean output should use `committed`.

## Upstream relationship

GitHub fork status is a distribution choice, not a runtime requirement. It preserves the official repository history, keeps the patch easy to inspect, and allows upstream updates to be incorporated. A local AionUi installation only needs this checkout and its installed dependencies.

The upstream project remains the source for general DeepSeek Harness documentation, releases, community support, and contribution rules. This fork keeps the upstream MIT license and attribution.

<a id="run"></a>

### Run the upstream Web UI

To run the published standalone Harness Web UI instead of this source integration:

```sh
npx @deepseek-ai/dsh web
```

<a id="run-from-source"></a>

### Run the upstream project from source

For a clean checkout without this integration, use the official repository:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## Development

Run the focused checks that cover this integration:

```sh
pnpm exec vitest run packages/acp/acp/tests --coverage --coverage.include='packages/acp/acp/src/index.ts'
pnpm exec vitest run --config vitest.snapshot.config.ts -t todo-write
pnpm run doc-sync
pnpm run lint
pnpm run build
```

Design and implementation references:

- [ACP rich-output decision](.agents/notes/implemented/feature/2026-08-14-acp-rich-output-projection.md)
- [ACP example and AionUi setup](examples/acp-agent/README.md#aionui-custom-agent)
- [ACP transport package](packages/acp/acp/README.md)
- [DeepSeek Harness architecture](docs/architecture.md)

## License

[MIT](LICENSE). Third-party dependencies and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
