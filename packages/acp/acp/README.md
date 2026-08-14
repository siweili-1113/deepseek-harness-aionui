# @deepseek-ai/dsh-acp

English | [中文](README.zh.md)

Fresh-session [Agent Client Protocol](https://agentclientprotocol.com) server over JSON-RPC stdio. Programmatic clients create harness agents, send text prompts, resolve one-shot permission requests by policy, and cancel work. The default committed projection serves automation clients such as [`dsh-subagent-acp`](../../subagent/subagent-acp/README.md); an explicit rich projection serves interactive ACP clients.

This package is a transport adapter, not a complete product UI or a capability seam. It does not expose editor navigation, transcript replay, commands, modes, configuration pickers, elicitation, titles, or session management. Rich output projects already logged reasoning, tool activity, and todo state through standard ACP updates; rendering policy and human questions remain client concerns.

## Plugin

`apply(ctx, config)` opens an `AgentSideConnection` on stdin/stdout and drives `ctx.agents`. Stdout is reserved for protocol frames.

| Config | Default | Meaning |
|---|---|---|
| `provider` | — | Initial provider route for every created agent. |
| `model` | — | Initial model for every created agent. |
| `output` | `committed` | `committed` emits complete assistant messages; `rich` emits live text, reasoning, tool calls, and plans. |

`provider` and `model` are optional so another agent/request listener may supply the target. The runnable ACP composition requires both.

## Protocol contract

| Method | Behavior |
|---|---|
| `initialize` | Negotiates the supported version and advertises baseline-only prompts (no image, audio, or embedded-context capability). No session, editor, terminal, filesystem, or MCP capability is advertised. |
| `authenticate` | No-op because the server advertises no authentication methods. |
| `session/new` | Creates a fresh agent with an absolute primary `cwd`; empty `additionalDirectories` and `mcpServers` are accepted, non-empty values reject. |
| `session/prompt` | Concatenates text blocks, renders baseline resource links as bracketed textual references, rejects empty or beyond-baseline input, permits one in-flight request per session, and waits for the whole agent to become idle. Normal quiescence reports `end_turn`; explicit ACP cancellation, disposal, or a prompt whose admission was discarded (a turnless slot) reports `cancelled`. |
| `session/cancel` | Cancels only the addressed agent and settles its pending prompt as `cancelled`; unknown ids are no-ops. |
| `session/update` | In `committed` mode, emits one `agent_message_chunk` per non-empty text block in a committed `assistant/message`. In `rich` mode, emits text and reasoning deltas, tool-call lifecycle updates, and todo plans without repeating the committed text. |
| `session/request_permission` | Offers one-shot allow/reject choices for bridge-owned approval requests carrying a tool call id. Clients may answer automatically. |

One connection may own several sessions. The bridge keys records by branded session id and checks exact agent identity before routing events or permission requests. Each session has an independent prompt slot, workspace, cancellation path, and disposer.

Committed output intentionally trades token-by-token latency for a clean automation result: uncommitted provider chunks and retry attempts cannot leak partial text. Rich output favors interactive latency and can therefore show provider deltas before the step commits; all projected values originate in the same session events used for durable reconstruction.

## Lifecycle

Client disconnect and Cordis disposal share one memoized teardown. The bridge first rejects new sessions and prompts, settles pending prompts, then drains continuable descendants only below this connection's exact owned Agents before disposing those handles in parallel and awaiting every result before reporting any failure. Other frontends sharing the Context retain their continuable forests and admission. An ACP-only plugin reload therefore leaves no orphan agent.

ACP requires each prompt response to carry a `stopReason`, but the bridge does not claim a prompt-specific turn outcome. Committed assistant messages stream across the owned activity, and steering or injected work may contribute before idle. Token-limit turn endings therefore do not become prompt-level ACP stop reasons (they settle as `end_turn`); a model error on the correlated turn rejects the prompt immediately.

## Running

`pnpm --dir /path/to/deepseek-harness run demo:acp` boots the repository's committed-output server composition. A parent harness can spawn it through [`@deepseek-ai/dsh-subagent-acp`](../../subagent/subagent-acp/README.md); interactive clients may select `rich` in their composition. The [ACP example](../../../examples/acp-agent/README.md#aionui-custom-agent) documents the AionUi launcher.

## Model Experience

### Prompt text

#### What the model sees

`session/prompt` text blocks are concatenated verbatim into one user message; a baseline resource link appears in that message as a bracketed `[resource_link name=… uri=…]` reference the model may open with its own tools. Protocol metadata, client capabilities, permission choices, and session ids never enter the model request.

#### Token effect

Prompt tokens are data-dependent and remain in that session's history until compaction. Concurrent ACP sessions retain independent contexts.

#### KV Cache effect

Append-only; the new user message follows the reusable request prefix and does not invalidate prior cache entries.

### Permission decisions

#### What the model sees

Nothing directly. The owning tool records its allowed, rejected, cancelled, or unavailable outcome through the normal tool-result path.

#### Token effect

Only the owning tool result contributes tokens.

#### KV Cache effect

Append-only through the owning tool result.

## Known Limitations and Deferred Work

- **Fresh sessions only** — load, list, resume, delete, and fork are unsupported.
- **Baseline prompts and one workspace only** — images, audio, embedded resources, non-empty additional directories, and MCP servers reject; resource links flatten to textual references rather than fetched content.
- **Projection is connection-wide** — one bridge instance selects committed or rich output for all sessions; titles, usage, and UI-specific render metadata stay off the wire.
- **Connection-owned lifetime** — one connection releases all of its sessions; per-session close is not implemented.
