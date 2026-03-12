import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const accountsRouteSource = readFileSync(
  join(__dirname, '../../app/api/accounts/route.ts'),
  'utf-8'
)

const settingsSource = readFileSync(
  join(__dirname, '../../app/settings/page.tsx'),
  'utf-8'
)

const typesSource = readFileSync(
  join(__dirname, '../types.ts'),
  'utf-8'
)

describe('Account balance summary in GET response', () => {
  it('GET query joins transactions to compute balance', () => {
    expect(accountsRouteSource).toContain('COALESCE(SUM(t.amount), 0) as balance')
  })

  it('GET query counts transactions per account', () => {
    expect(accountsRouteSource).toContain('COUNT(t.id) as transaction_count')
  })

  it('GET query uses LEFT JOIN so accounts with no transactions still appear', () => {
    expect(accountsRouteSource).toContain('LEFT JOIN transactions t ON t.account_id = a.id')
  })

  it('GET query groups by account id', () => {
    expect(accountsRouteSource).toContain('GROUP BY a.id')
  })
})

describe('Shared AccountWithBalance type', () => {
  it('exports AccountWithBalance extending Account', () => {
    expect(typesSource).toContain('export interface AccountWithBalance extends Account')
  })

  it('includes balance and transaction_count fields', () => {
    expect(typesSource).toContain('balance: number')
    expect(typesSource).toContain('transaction_count: number')
  })
})

describe('Settings page displays account balance', () => {
  it('imports AccountWithBalance from shared types', () => {
    expect(settingsSource).toContain('AccountWithBalance')
    expect(settingsSource).toContain('@/lib/types')
  })

  it('does not define a local Account interface', () => {
    expect(settingsSource).not.toMatch(/^interface Account\b/m)
  })

  it('uses Intl.NumberFormat with acc.currency for balance display', () => {
    expect(settingsSource).toContain('Intl.NumberFormat')
    expect(settingsSource).toContain('acc.currency')
    expect(settingsSource).toContain("style: 'currency'")
  })

  it('uses color coding for positive vs negative balances', () => {
    expect(settingsSource).toContain('emerald')
    expect(settingsSource).toContain('acc.balance >= 0')
  })
})
