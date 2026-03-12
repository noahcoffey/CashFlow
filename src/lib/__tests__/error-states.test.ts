import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('dashboard page error handling', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../app/dashboard/page.tsx'),
    'utf-8'
  )

  it('declares an error state', () => {
    expect(source).toContain('useState<string | null>(null)')
    expect(source).toContain('setError')
  })

  it('catches fetch errors and sets error state', () => {
    expect(source).toContain('.catch((err) => setError(err.message))')
  })

  it('checks response.ok before parsing JSON', () => {
    expect(source).toContain('if (!r.ok) throw new Error')
  })

  it('renders an error UI with retry', () => {
    expect(source).toContain('Failed to load dashboard')
    expect(source).toContain('Try again')
  })
})

describe('transactions page error handling', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../app/transactions/page.tsx'),
    'utf-8'
  )

  it('declares an error state', () => {
    expect(source).toContain('const [error, setError] = useState<string | null>(null)')
  })

  it('catches fetch errors and sets error state', () => {
    expect(source).toContain('.catch((err) => setError(err.message))')
  })

  it('checks response.ok before parsing JSON', () => {
    expect(source).toContain('if (!r.ok) throw new Error')
  })

  it('renders an error UI with retry button', () => {
    expect(source).toContain('Failed to load transactions')
    expect(source).toContain('fetchTransactions')
    expect(source).toContain('Try again')
  })
})
