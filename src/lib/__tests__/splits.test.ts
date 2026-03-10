import { describe, it, expect } from 'vitest'

// Test the split validation logic used by the API
function validateSplits(
  txnAmount: number,
  splits: Array<{ amount: number; category_id: string | null }>
): { valid: boolean; error?: string } {
  const splitSum = splits.reduce((sum, s) => sum + s.amount, 0)
  const diff = Math.abs(splitSum - txnAmount)

  if (diff > 0.01) {
    return {
      valid: false,
      error: `Splits must sum to transaction amount (${txnAmount.toFixed(2)}). Current sum: ${splitSum.toFixed(2)}`,
    }
  }

  if (splits.length < 2) {
    return { valid: false, error: 'At least 2 splits are required' }
  }

  return { valid: true }
}

describe('split validation', () => {
  it('accepts balanced splits', () => {
    const result = validateSplits(-100, [
      { amount: -60, category_id: 'cat-1' },
      { amount: -40, category_id: 'cat-2' },
    ])
    expect(result.valid).toBe(true)
  })

  it('rejects unbalanced splits', () => {
    const result = validateSplits(-100, [
      { amount: -60, category_id: 'cat-1' },
      { amount: -30, category_id: 'cat-2' },
    ])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('sum to transaction amount')
  })

  it('allows floating point tolerance', () => {
    const result = validateSplits(-99.99, [
      { amount: -33.33, category_id: 'cat-1' },
      { amount: -33.33, category_id: 'cat-2' },
      { amount: -33.33, category_id: 'cat-3' },
    ])
    expect(result.valid).toBe(true)
  })

  it('rejects single split', () => {
    const result = validateSplits(-100, [
      { amount: -100, category_id: 'cat-1' },
    ])
    expect(result.valid).toBe(false)
  })

  it('works with positive amounts (income)', () => {
    const result = validateSplits(1000, [
      { amount: 600, category_id: 'cat-salary' },
      { amount: 400, category_id: 'cat-freelance' },
    ])
    expect(result.valid).toBe(true)
  })
})
