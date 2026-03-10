import { spawn } from 'child_process'

export async function runClaudePrompt(prompt: string, label = 'ai'): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const promptPreview = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt
    console.log(`[${label}] Spawning claude CLI (prompt: ${prompt.length} chars)`)
    console.log(`[${label}] Prompt preview: ${promptPreview}`)

    // Strip CLAUDECODE env var to avoid "nested session" detection,
    // and close stdin so claude can't hang waiting for interactive input
    const cleanEnv = { ...process.env }
    delete cleanEnv.CLAUDECODE
    delete cleanEnv.CLAUDE_CODE

    const proc = spawn('claude', ['-p', prompt], {
      timeout: 300000,
      env: cleanEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    console.log(`[${label}] Process spawned (pid: ${proc.pid})`)

    let output = ''
    let errorOutput = ''
    let stdoutChunks = 0
    let stderrChunks = 0

    proc.stdout.on('data', (data: Buffer) => {
      stdoutChunks++
      const chunk = data.toString()
      output += chunk
      if (stdoutChunks <= 3) {
        console.log(`[${label}] stdout chunk #${stdoutChunks} (${chunk.length} bytes, total: ${output.length} bytes)`)
      } else if (stdoutChunks % 10 === 0) {
        console.log(`[${label}] stdout chunk #${stdoutChunks} (total: ${output.length} bytes)`)
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderrChunks++
      const chunk = data.toString()
      errorOutput += chunk
      console.log(`[${label}] stderr chunk #${stderrChunks}: ${chunk.trim()}`)
    })

    proc.on('close', (code: number | null) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[${label}] Process exited (code: ${code}, elapsed: ${elapsed}s, stdout: ${output.length} bytes in ${stdoutChunks} chunks, stderr: ${errorOutput.length} bytes)`)
      if (code === 0) {
        console.log(`[${label}] Response preview: ${output.trim().substring(0, 200)}`)
        resolve(output.trim())
      } else {
        console.error(`[${label}] FAILED - stderr: ${errorOutput.substring(0, 500)}`)
        reject(new Error(errorOutput || `Claude exited with code ${code}`))
      }
    })

    proc.on('error', (err: NodeJS.ErrnoException) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error(`[${label}] Process error after ${elapsed}s: ${err.message} (code: ${err.code})`)
      if (err.code === 'ENOENT') {
        reject(new Error('CLAUDE_NOT_FOUND'))
      } else {
        reject(err)
      }
    })

    // Periodic heartbeat so you know it's still alive
    const heartbeat = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      console.log(`[${label}] Still waiting... (${elapsed}s elapsed, ${stdoutChunks} stdout chunks, ${output.length} bytes so far)`)
    }, 15000)

    proc.on('close', () => clearInterval(heartbeat))
    proc.on('error', () => clearInterval(heartbeat))
  })
}

export function extractJSON(text: string): any {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Try fixing common issues
      const cleaned = jsonMatch[0]
        .replace(/,\s*([}\]])/g, '$1') // trailing commas
        .replace(/'/g, '"') // single quotes
      try {
        return JSON.parse(cleaned)
      } catch {
        console.error('[ai] Failed to parse JSON even after cleanup. Raw text:', text.substring(0, 500))
        return null
      }
    }
  }
  console.error('[ai] No JSON found in response. Raw text:', text.substring(0, 500))
  return null
}
