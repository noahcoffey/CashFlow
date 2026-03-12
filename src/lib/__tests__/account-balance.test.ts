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

describe('Settings page displays account balance', () => {
  it('Account interface includes balance and transaction_count', () => {
    expect(settingsSource).toMatch(/balance:\s*number/)
    expect(settingsSource).toMatch(/transaction_count:\s*number/)
  })

  it('displays balance with currency formatting', () => {
    expect(settingsSource).toContain('acc.balance')
    expect(settingsSource).toContain('minimumFractionDigits: 2')
  })

  it('uses color coding for positive vs negative balances', () => {
    expect(settingsSource).toContain('emerald')
    expect(settingsSource).toContain('acc.balance >= 0')
  })
})
