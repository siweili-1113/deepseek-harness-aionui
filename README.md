# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## AionUi integration fork

This public fork adds an [AionUi](https://github.com/iOfficeAI/AionUi) integration to DeepSeek Harness. AionUi starts Harness as a custom ACP agent and communicates with it over newline-delimited JSON-RPC on stdin/stdout.

This is not a standalone plugin installed inside DeepSeek Harness. The implementation extends Harness's existing ACP transport with an opt-in `rich` output projection and provides [`scripts/aionui-acp.mjs`](scripts/aionui-acp.mjs) as the local launcher that AionUi executes. From AionUi's perspective it behaves like an ACP agent integration; inside this repository it is an ACP adapter plus launcher.

The integration gives AionUi:

- streamed assistant text and reasoning;
- tool-call start, completion, and failure updates;
- `todo/write` state as ACP plan updates;
- normal Harness tool execution, workspace permissions, session logging, and DeepSeek model access.

The default `committed` ACP projection remains available for automation clients. The AionUi launcher selects `rich` output so the interface can show an agent turn while it runs.

### Connect it to AionUi

Install Node.js 22.19 or newer, then clone this integration branch and install its dependencies:

```sh
git clone --branch codex/aionui-acp-bridge git@github.com:siweili-1113/deepseek-harness.git
cd deepseek-harness
corepack enable
pnpm install --frozen-lockfile
```

In AionUi, open **Settings → Agents → Add custom Agent** and enter:

```text
Name: DeepSeek Harness
Command: node
Arguments: /absolute/path/to/deepseek-harness/scripts/aionui-acp.mjs
Environment:
  DEEPSEEK_API_KEY=<your DeepSeek API key>
```

The connection test starts the ACP server without calling the model. The first prompt requires a valid DeepSeek API key. Keep the key in AionUi's environment configuration or a local `.env`; never commit it.

For another computer, clone the same branch, run `pnpm install --frozen-lockfile`, update the absolute launcher path in AionUi, and configure the API key again. Do not copy `node_modules`; `pnpm install` recreates it for that computer. See the [ACP example guide](examples/acp-agent/README.md#aionui-custom-agent) for protocol and troubleshooting details.

### Why this is a fork

GitHub fork status is not required at runtime. It preserves the relationship to the official DeepSeek Harness repository, makes this patch easy to compare or contribute upstream, and allows later upstream updates to be incorporated. A local AionUi installation only needs this checkout and its dependencies.

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
