import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const subscriptionsSource = readFileSync(
  join(__dirname, '../../app/subscriptions/page.tsx'),
  'utf-8'
)

const importSource = readFileSync(
  join(__dirname, '../../app/import/page.tsx'),
  'utf-8'
)

describe('Subscriptions page error handling', () => {
  it('has error state', () => {
    expect(subscriptionsSource).toContain('const [error, setError] = useState<string | null>(null)')
  })

  it('checks response.ok on recurring transactions fetch', () => {
    expect(subscriptionsSource).toContain('if (!res.ok) throw new Error')
  })

  it('checks response.ok on bills fetch', () => {
    expect(subscriptionsSource).toContain('if (!res.ok) throw new Error(`Failed to load bills')
  })

  it('sets error state on catch', () => {
    expect(subscriptionsSource).toContain('setError(')
  })

  it('clears error on retry', () => {
    expect(subscriptionsSource).toContain('setError(null)')
  })

  it('renders error UI with AlertCircle', () => {
    expect(subscriptionsSource).toContain('if (error)')
    expect(subscriptionsSource).toContain('AlertCircle')
    expect(subscriptionsSource).toContain('Failed to load subscriptions')
  })

  it('has a retry button in error state', () => {
    expect(subscriptionsSource).toContain('Try again')
  })
})

describe('Import page error handling', () => {
  it('has accountsError state', () => {
    expect(importSource).toContain('const [accountsError, setAccountsError] = useState<string | null>(null)')
  })

  it('checks response.ok on accounts fetch', () => {
    expect(importSource).toContain('if (!res.ok) throw new Error(`Failed to load accounts')
  })

  it('checks response.ok on parse fetch', () => {
    expect(importSource).toContain('Failed to parse CSV')
    expect(importSource).toContain('if (!res.ok)')
  })

  it('checks response.ok on import fetch', () => {
    expect(importSource).toMatch(/if \(!res\.ok\).*Import failed/)
  })

  it('checks response.ok on parseAndImportFile parse step', () => {
    expect(importSource).toMatch(/if \(!parseRes\.ok\)/)
  })

  it('renders error UI for accounts loading failure', () => {
    expect(importSource).toContain('accountsError')
    expect(importSource).toContain('Failed to load accounts')
    expect(importSource).toContain('Try again')
  })

  it('has a loadAccounts retry function', () => {
    expect(importSource).toContain('const loadAccounts = async')
    expect(importSource).toContain('onClick={loadAccounts}')
  })
})
