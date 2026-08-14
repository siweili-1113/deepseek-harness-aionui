# Agent Note: ACP rich output projection

Status: implemented

English | [中文](2026-08-14-acp-rich-output-projection.zh.md)

## Problem

The ACP bridge's committed-message projection is appropriate for automated parents because it never exposes partial provider output or discarded attempts. Interactive ACP clients such as AionUi use the same standard protocol but need incremental answer text, reasoning, tool status, and plan state to present an agent turn while it runs. Without an explicit projection, those clients show only the final answer even though the authoritative session log already records the required events.

Restoring the former editor bridge would also restore unrelated product responsibilities: session browsing, commands, configuration pickers, human elicitation, editor metadata, and tool-specific rendering policy. The interactive use case needs live transport of a small event subset, not a second Harness UI.

## Decision

`@deepseek-ai/dsh-acp` has a connection-wide `output` configuration with `committed` and `rich` values. `committed` remains the default and preserves the automation behavior. `rich` emits text deltas as `agent_message_chunk`, reasoning deltas as `agent_thought_chunk`, tool calls and results as ACP tool-call lifecycle updates, and `todo/write` snapshots as ACP plans. It does not repeat the committed assistant text after streaming the deltas.

Every projected value comes from `session/event`, so model-visible activity remains reconstructable from the durable log. Tool execution stays inside Harness. The ACP cards are a generic projection: common tool names select an ACP category, common argument fields supply a concise title, parsed arguments become `rawInput`, and model-facing text or image references plus durable metadata become `rawOutput`. The bridge does not mount tool renderers or add terminal, diff, location, title, usage, command, mode, session-navigation, or elicitation support.

`@deepseek-ai/dsh-acp-demo` forwards the projection as `acpOutput`. The shipped ACP leaf reads `DSH_ACP_OUTPUT`, defaulting to `committed`, while `scripts/aionui-acp.mjs` starts that leaf with `rich` unless the caller already selected another value. The launcher invokes the source bin through Node and `tsx` directly so stdout remains reserved for newline-delimited JSON-RPC.

The ACP bridge tests pin default committed output and rich text, reasoning, tool, failure, and plan updates. The keyless `todo-write` ACP snapshot runs the assembled example with rich output and records its reasoning, tool-call lifecycle, plan snapshot, tool result, and final answer frames. The launcher smoke performs ACP `initialize` and `session/new` without a model credential.

The earlier [automation-only ACP decision](../simplification/2026-07-23-acp-automation-only-protocol.md) remains authoritative for the default projection and for every omitted product surface. This decision is a narrow explicit exception for live standard updates, not a reversal to an editor-owned UI.

## Alternatives considered

**Make rich output the default.** Rejected because automated parents rely on complete committed text and must not receive partial or discarded provider output without opting in.

**Restore the former general editor bridge.** Rejected because session management, commands, modes, configuration, human questions, and tool-specific presentation still belong to product hosts rather than this transport.

**Add an AionUi-specific plugin or private wire protocol.** Rejected because AionUi already consumes standard ACP updates and the projection is useful to any compatible interactive client. A client-branded protocol would duplicate typed ACP messages and couple the Harness package to one UI.

**Read progress from persistence in the client.** Rejected because it would require shared filesystem access, polling, durable-format knowledge, and session-id reconciliation when ACP already provides a live notification channel.

## Consequences

Automation behavior stays unchanged unless a deployment selects `rich`. Interactive ACP clients can render a useful live turn from standard messages without gaining ownership of tool execution or Harness session management. The bridge carries more event and per-call state in rich mode, and its generic tool cards intentionally omit tool-specific diffs, terminals, and locations. A provider retry can expose partial text in rich mode before the step commits; deployments that require attempt-clean output keep the default committed projection.
