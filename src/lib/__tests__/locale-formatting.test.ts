import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(
  join(__dirname, '../utils.ts'),
  'utf-8'
)

describe('Locale-aware formatting', () => {
  it('formatCurrency uses browser default locale (undefined) instead of en-US', () => {
    expect(source).not.toContain("Intl.NumberFormat('en-US'")
    expect(source).toContain('Intl.NumberFormat(undefined')
  })

  it('formatDate uses browser default locale (undefined) instead of en-US', () => {
    expect(source).not.toContain("toLocaleDateString('en-US'")
    expect(source).toContain('toLocaleDateString(undefined')
  })

  it('formatCurrency still accepts a currency parameter with USD default', () => {
    expect(source).toContain("currency = 'USD'")
  })

  it('formatDate still accepts string or Date input', () => {
    expect(source).toContain('date: string | Date')
  })
})
