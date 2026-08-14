#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const child = spawn(process.execPath, [
  '--import',
  'tsx',
  join(root, 'packages/examples/acp-demo/src/bin.ts'),
  '--config',
  join(root, 'examples/acp-agent/cordis.yml'),
], {
  cwd: root,
  env: {
    ...process.env,
    DSH_ACP_OUTPUT: process.env.DSH_ACP_OUTPUT ?? 'rich',
  },
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal)
  })
}

child.on('error', (error) => {
  console.error(`aionui-acp: failed to start DeepSeek Harness: ${error.message}`)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)
})
