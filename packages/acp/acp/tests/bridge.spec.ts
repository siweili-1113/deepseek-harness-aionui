import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import { CallId, createToolResultMessage, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId, TOOL_NOT_STARTED } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { makeBridgeHarness, textResponse, type BridgeHarness } from './harness.ts'

describe('ACP bridge', () => {
  let harness: BridgeHarness | undefined

  afterEach(async () => {
    await harness?.dispose()
    harness = undefined
  })

  it('advertises only fresh text sessions', async () => {
    harness = await makeBridgeHarness()
    const response = await harness.client.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { _meta: { terminal_output: true } },
    })

    expect(response).toEqual({
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: { name: 'deepseek-harness-acp', version: '0.0.1' },
      agentCapabilities: {
        promptCapabilities: { image: false, audio: false, embeddedContext: false },
      },
      authMethods: [],
    })
  })

  it('negotiates an unsupported version and accepts the required no-op authentication call', async () => {
    harness = await makeBridgeHarness()
    const response = await harness.client.initialize({ protocolVersion: 0, clientCapabilities: {} })
    expect(response.protocolVersion).toBe(PROTOCOL_VERSION)
    await expect(harness.client.authenticate({ methodId: 'unused' })).resolves.toEqual({})
  })

  it('creates a session, emits one committed answer, and settles the prompt', async () => {
    harness = await makeBridgeHarness({ script: [textResponse('hello there')] })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    const result = await harness.client.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'say hello' }],
    })

    expect(result.stopReason).toBe('end_turn')
    await vi.waitFor(() => { expect(harness!.updates).toHaveLength(1) })
    expect(harness.updates).toEqual([{
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'hello there' },
    }])
    expect(harness.ctx.agents.get(SessionId(sessionId))?.session.header.cwd).toBe(process.cwd())
    expect(harness.adapter.requests[0]?.messages.at(-1)?.content).toEqual([{ type: 'text', text: 'say hello' }])
  })

  it('streams reasoning and answer deltas without repeating the committed answer in rich mode', async () => {
    const script: StreamChunk[] = [
      { type: 'block-start', index: 0, blockType: 'reasoning' },
      { type: 'reasoning-delta', index: 0, text: 'inspect' },
      { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'inspect' } },
      { type: 'block-start', index: 1, blockType: 'text' },
      { type: 'text-delta', index: 1, text: 'done' },
      { type: 'block-end', index: 1, block: { type: 'text', text: 'done' } },
      { type: 'finish', reason: { kind: 'stop' } },
    ]
    harness = await makeBridgeHarness({ script: [script], config: { output: 'rich' } })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })

    await harness.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'go' }] })

    await vi.waitFor(() => { expect(harness!.updates).toHaveLength(2) })
    expect(harness.updates).toEqual([
      {
        sessionUpdate: 'agent_thought_chunk',
        messageId: `${sessionId}:1:1:thought`,
        content: { type: 'text', text: 'inspect' },
      },
      {
        sessionUpdate: 'agent_message_chunk',
        messageId: `${sessionId}:1:1:answer`,
        content: { type: 'text', text: 'done' },
      },
    ])
  })

  it('projects tool execution as ACP tool-call updates in rich mode', async () => {
    const callId = CallId('call-1')
    const toolRequest: StreamChunk[] = [
      { type: 'block-start', index: 0, blockType: 'tool-call' },
      { type: 'tool-call-delta', index: 0, id: callId, name: 'echo', argumentsDelta: '{"value":"hello"}' },
      { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name: 'echo', arguments: '{"value":"hello"}' } },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ]
    harness = await makeBridgeHarness({
      script: [toolRequest, textResponse('finished')],
      config: { output: 'rich' },
    })
    harness.ctx.tools.register(defineTool({
      name: 'echo',
      description: 'Echo a value.',
      parameters: { value: { type: 'string', required: true } },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: args => Promise.resolve(`echo:${args.value}`),
    }))
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })

    await harness.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'use echo' }] })

    expect(harness.updates[0]).toMatchObject({
      sessionUpdate: 'tool_call',
      toolCallId: callId,
      title: 'echo',
      kind: 'other',
      status: 'in_progress',
      rawInput: { value: 'hello' },
    })
    expect(harness.updates[1]).toMatchObject({
      sessionUpdate: 'tool_call_update',
      toolCallId: callId,
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: 'echo:hello' } }],
    })
    expect(harness.updates.filter(update => update.sessionUpdate === 'agent_message_chunk'))
      .toHaveLength('finished'.length)
  })

  it('projects todo snapshots as ACP plans in rich mode', async () => {
    harness = await makeBridgeHarness({ config: { output: 'rich' } })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    const session = harness.ctx.sessions.get(SessionId(sessionId))
    expect(session).toBeDefined()

    session!.append('turn/start', { turn: 1 })
    session!.append('todo/write', {
      todos: [
        { content: 'Inspect the bridge', status: 'completed' },
        { content: 'Verify AionUi', status: 'in_progress' },
      ],
    })

    await vi.waitFor(() => { expect(harness!.updates).toHaveLength(1) })
    expect(harness.updates[0]).toEqual({
      sessionUpdate: 'plan',
      entries: [
        { content: 'Inspect the bridge', status: 'completed', priority: 'medium' },
        { content: 'Verify AionUi', status: 'in_progress', priority: 'medium' },
      ],
    })
  })

  it('preserves malformed inputs and failed unpaired results in rich tool updates', async () => {
    harness = await makeBridgeHarness({ config: { output: 'rich' } })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    const session = harness.ctx.sessions.get(SessionId(sessionId))!
    const callId = CallId('malformed-call')

    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/chunk', {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 0, text: '' },
    })
    session.append('assistant/chunk', {
      turn: 1,
      step: 1,
      chunk: { type: 'reasoning-delta', index: 0, text: '' },
    })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId,
      name: 'custom_tool',
      arguments: '{bad json',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId,
        content: [{ type: 'reasoning', text: 'internal only' }],
        isError: true,
      }),
      error: { name: 'ToolError', code: 'FAILED' },
      meta: { source: 'test' },
    }, { surfaceOp: 'append' })
    const orphanId = CallId('orphan-call')
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({ callId: orphanId, content: [], isError: true }),
      error: { name: 'Interrupted', code: TOOL_NOT_STARTED },
    }, { surfaceOp: 'append' })

    await vi.waitFor(() => { expect(harness!.updates).toHaveLength(3) })
    expect(harness.updates).toEqual([
      {
        sessionUpdate: 'tool_call',
        toolCallId: callId,
        title: 'custom tool',
        kind: 'other',
        status: 'in_progress',
        rawInput: { raw: '{bad json' },
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: callId,
        title: 'custom tool',
        kind: 'other',
        status: 'failed',
        rawOutput: {
          content: [{ type: 'reasoning', text: 'internal only' }],
          meta: { source: 'test' },
          error: { name: 'ToolError', code: 'FAILED' },
        },
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: orphanId,
        status: 'failed',
        rawOutput: {
          content: [],
          error: { name: 'Interrupted', code: TOOL_NOT_STARTED },
        },
      },
    ])
  })

  it('classifies generic rich tool cards and renders image-result references', async () => {
    harness = await makeBridgeHarness({ config: { output: 'rich' } })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    const session = harness.ctx.sessions.get(SessionId(sessionId))!
    const calls = [
      { id: CallId('read-call'), name: 'read_image', arguments: '{"path":"/tmp/image.png"}' },
      { id: CallId('edit-call'), name: 'edit', arguments: '{"description":"Apply change"}' },
      { id: CallId('search-call'), name: 'glob', arguments: '{"query":"*.ts"}' },
      { id: CallId('fetch-call'), name: 'web_fetch', arguments: '{"url":"https://example.com"}' },
      { id: CallId('terminal-call'), name: 'terminal_open', arguments: '{"description":" ","command":"pwd"}' },
      { id: CallId('bash-call'), name: 'bash', arguments: '"plain"' },
      { id: CallId('null-call'), name: 'custom_null', arguments: 'null' },
    ]

    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    for (const call of calls) {
      session.append('tool/call', {
        turn: 1,
        step: 1,
        callId: call.id,
        name: call.name,
        arguments: call.arguments,
      })
    }
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: calls[0]!.id,
        content: [{
          type: 'image',
          attachment: {
            attachmentId: 'image-1' as never,
            mediaType: 'image/png',
            bytes: 1,
            width: 1,
            height: 1,
          },
        }],
        isError: false,
      }),
      error: { name: 'PreviewError', code: 'IMAGE_PREVIEW_FAILED' },
    }, { surfaceOp: 'append' })

    await vi.waitFor(() => { expect(harness!.updates).toHaveLength(8) })
    expect(harness.updates.slice(0, 7)).toMatchObject([
      { title: '/tmp/image.png', kind: 'read' },
      { title: 'Apply change', kind: 'edit' },
      { title: '*.ts', kind: 'search' },
      { title: 'https://example.com', kind: 'fetch' },
      { title: 'pwd', kind: 'execute' },
      { title: 'bash', kind: 'execute', rawInput: 'plain' },
      { title: 'custom null', kind: 'other', rawInput: null },
    ])
    expect(harness.updates[7]).toMatchObject({
      sessionUpdate: 'tool_call_update',
      toolCallId: calls[0]!.id,
      status: 'failed',
      content: [{
        type: 'content',
        content: { type: 'text', text: '[image attachment image-1]' },
      }],
    })
  })

  it('leaves absent agent targets for request listeners to supply', async () => {
    harness = await makeBridgeHarness({ config: { provider: undefined, model: undefined } })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })

    expect(harness.ctx.agents.get(SessionId(sessionId))?.options).toEqual({})
  })

  it('concatenates text blocks without exposing protocol framing to the model', async () => {
    harness = await makeBridgeHarness({ script: [textResponse('done')] })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    await harness.client.prompt({
      sessionId,
      prompt: [
        { type: 'text', text: 'first' },
        { type: 'text', text: ' second' },
      ],
    })

    expect(harness.adapter.requests[0]?.messages.at(-1)?.content).toEqual([{ type: 'text', text: 'first second' }])
  })

  it('renders the deployment persona for an ACP-created agent', async () => {
    harness = await makeBridgeHarness({ persona: 'Automation persona for {{model}} in {{cwd}}.', script: [textResponse('ok')] })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    await harness.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'go' }] })
    expect(harness.adapter.requests[0]?.system).toContain(`Automation persona for mock in ${process.cwd()}.`)
  })

  it('requires one absolute workspace and no MCP servers', async () => {
    harness = await makeBridgeHarness()
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })

    await expect(harness.client.newSession({ cwd: 'relative', mcpServers: [] })).rejects.toThrow(/absolute path/)
    await expect(harness.client.newSession({
      cwd: process.cwd(),
      mcpServers: [],
      additionalDirectories: ['/tmp/other'],
    })).rejects.toThrow(/additionalDirectories/)
    await expect(harness.client.newSession({
      cwd: process.cwd(),
      mcpServers: [{ name: 'fs', command: 'node', args: [], env: [] }],
    })).rejects.toThrow(/mcpServers/)

    await expect(harness.client.newSession({
      cwd: process.cwd(),
      mcpServers: [],
      additionalDirectories: [],
    })).resolves.toHaveProperty('sessionId')
  })

  it('rejects empty and beyond-baseline prompts before a turn starts', async () => {
    harness = await makeBridgeHarness()
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })

    await expect(harness.client.prompt({ sessionId, prompt: [{ type: 'text', text: '  ' }] }))
      .rejects.toThrow(/empty prompt/)
    await expect(harness.client.prompt({
      sessionId,
      prompt: [{ type: 'image', data: '', mimeType: 'image/png' }],
    })).rejects.toThrow(/only text and resource_link/)
    expect(harness.ctx.agents.get(SessionId(sessionId))?.session.events.some(event => event.type === 'turn/start')).toBe(false)
  })

  it('renders baseline resource links as textual references in the user message', async () => {
    harness = await makeBridgeHarness({ script: [textResponse('done')] })
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    await harness.client.prompt({
      sessionId,
      prompt: [
        { type: 'text', text: 'summarize' },
        { type: 'resource_link', name: 'notes.txt', uri: 'file:///tmp/notes.txt' },
      ],
    })
    expect(harness.adapter.requests[0]?.messages.at(-1)?.content).toEqual([{
      type: 'text',
      text: 'summarize\n[resource_link name="notes.txt" uri="file:///tmp/notes.txt"]\n',
    }])
  })

  it('rejects prompts for unknown sessions and ignores unknown cancellation', async () => {
    harness = await makeBridgeHarness()
    await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    await expect(harness.client.prompt({ sessionId: 'missing', prompt: [{ type: 'text', text: 'go' }] }))
      .rejects.toThrow(/unknown session/)
    await expect(harness.client.cancel({ sessionId: 'missing' })).resolves.toBeUndefined()
  })
})
