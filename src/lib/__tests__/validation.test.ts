import { describe, it, expect } from 'vitest'
import {
  createAccountSchema,
  updateAccountSchema,
  deleteAccountSchema,
  createTransactionSchema,
  updateTransactionSchema,
  deleteTransactionSchema,
  createBudgetSchema,
  validateBody,
} from '@/lib/validation'

describe('createAccountSchema', () => {
  it('accepts valid account data', () => {
    const result = createAccountSchema.safeParse({
      name: 'Chase Checking',
      type: 'checking',
      institution: 'Chase Bank',
      currency: 'USD',
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for optional fields', () => {
    const result = createAccountSchema.safeParse({ name: 'Test', type: 'savings' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.institution).toBe('')
      expect(result.data.currency).toBe('USD')
    }
  })

  it('rejects empty name', () => {
    const result = createAccountSchema.safeParse({ name: '', type: 'checking' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid account type', () => {
    const result = createAccountSchema.safeParse({ name: 'Test', type: 'bitcoin' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createAccountSchema.safeParse({ type: 'checking' })
    expect(result.success).toBe(false)
  })
})

describe('updateAccountSchema', () => {
  it('accepts valid update with id', () => {
    const result = updateAccountSchema.safeParse({ id: 'abc-123', name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('rejects missing id', () => {
    const result = updateAccountSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(false)
  })

  it('rejects empty id', () => {
    const result = updateAccountSchema.safeParse({ id: '', name: 'New Name' })
    expect(result.success).toBe(false)
  })
})

describe('createTransactionSchema', () => {
  const validTxn = {
    account_id: 'acc-1',
    date: '2026-03-15',
    amount: -50.25,
    raw_description: 'STARBUCKS #1234',
  }

  it('accepts valid transaction', () => {
    const result = createTransactionSchema.safeParse(validTxn)
    expect(result.success).toBe(true)
  })

  it('accepts transaction with all optional fields', () => {
    const result = createTransactionSchema.safeParse({
      ...validTxn,
      display_name: 'Starbucks',
      category_id: 'cat-food',
      notes: 'Morning coffee',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid date format', () => {
    const result = createTransactionSchema.safeParse({ ...validTxn, date: '03/15/2026' })
    expect(result.success).toBe(false)
  })

  it('rejects missing account_id', () => {
    const { account_id, ...rest } = validTxn
    const result = createTransactionSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects non-numeric amount', () => {
    const result = createTransactionSchema.safeParse({ ...validTxn, amount: 'fifty' })
    expect(result.success).toBe(false)
  })

  it('rejects Infinity amount', () => {
    const result = createTransactionSchema.safeParse({ ...validTxn, amount: Infinity })
    expect(result.success).toBe(false)
  })

  it('rejects empty description', () => {
    const result = createTransactionSchema.safeParse({ ...validTxn, raw_description: '' })
    expect(result.success).toBe(false)
  })

  it('applies defaults for optional fields', () => {
    const result = createTransactionSchema.safeParse(validTxn)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.display_name).toBe('')
      expect(result.data.notes).toBe('')
    }
  })
})

describe('updateTransactionSchema', () => {
  it('accepts valid update with only id', () => {
    const result = updateTransactionSchema.safeParse({ id: 'txn-1' })
    expect(result.success).toBe(true)
  })

  it('accepts partial updates', () => {
    const result = updateTransactionSchema.safeParse({ id: 'txn-1', amount: -100, is_reconciled: 1 })
    expect(result.success).toBe(true)
  })

  it('rejects invalid is_reconciled value', () => {
    const result = updateTransactionSchema.safeParse({ id: 'txn-1', is_reconciled: 2 })
    expect(result.success).toBe(false)
  })

  it('rejects missing id', () => {
    const result = updateTransactionSchema.safeParse({ amount: -50 })
    expect(result.success).toBe(false)
  })
})

describe('createBudgetSchema', () => {
  it('accepts valid budget', () => {
    const result = createBudgetSchema.safeParse({
      category_id: 'cat-food',
      amount: 500,
      period: 'monthly',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative budget amount', () => {
    const result = createBudgetSchema.safeParse({
      category_id: 'cat-food',
      amount: -100,
      period: 'monthly',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid period', () => {
    const result = createBudgetSchema.safeParse({
      category_id: 'cat-food',
      amount: 500,
      period: 'daily',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional date fields', () => {
    const result = createBudgetSchema.safeParse({
      category_id: 'cat-food',
      amount: 500,
      period: 'monthly',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid date format in start_date', () => {
    const result = createBudgetSchema.safeParse({
      category_id: 'cat-food',
      amount: 500,
      period: 'monthly',
      start_date: 'January 1',
    })
    expect(result.success).toBe(false)
  })
})

describe('validateBody helper', () => {
  it('returns success with parsed data for valid input', () => {
    const result = validateBody(deleteAccountSchema, { id: 'acc-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('acc-1')
    }
  })

  it('returns error message for invalid input', () => {
    const result = validateBody(deleteAccountSchema, { id: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('ID is required')
      expect(result.status).toBe(400)
    }
  })

  it('joins multiple errors with semicolons', () => {
    const result = validateBody(createTransactionSchema, {})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain(';')
    }
  })
})
