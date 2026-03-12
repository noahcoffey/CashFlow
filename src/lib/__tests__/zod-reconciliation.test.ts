import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  createReconciliationSchema,
  completeReconciliationSchema,
  validateBody,
} from '../validation'

describe('createReconciliationSchema', () => {
  it('accepts valid reconciliation session', () => {
    const result = createReconciliationSchema.safeParse({
      account_id: 'acc-123',
      statement_date: '2026-03-01',
      statement_balance: 1500.50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing account_id', () => {
    const result = createReconciliationSchema.safeParse({
      statement_date: '2026-03-01',
      statement_balance: 1500,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing statement_date', () => {
    const result = createReconciliationSchema.safeParse({
      account_id: 'acc-123',
      statement_balance: 1500,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing statement_balance', () => {
    const result = createReconciliationSchema.safeParse({
      account_id: 'acc-123',
      statement_date: '2026-03-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = createReconciliationSchema.safeParse({
      account_id: 'acc-123',
      statement_date: '03/01/2026',
      statement_balance: 1500,
    })
    expect(result.success).toBe(false)
  })

  it('accepts negative statement balance', () => {
    const result = createReconciliationSchema.safeParse({
      account_id: 'acc-123',
      statement_date: '2026-03-01',
      statement_balance: -200.50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-finite balance', () => {
    const result = createReconciliationSchema.safeParse({
      account_id: 'acc-123',
      statement_date: '2026-03-01',
      statement_balance: Infinity,
    })
    expect(result.success).toBe(false)
  })
})

describe('completeReconciliationSchema', () => {
  it('accepts status with defaults', () => {
    const result = completeReconciliationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('completed')
    }
  })

  it('accepts completed status with clearedIds', () => {
    const result = completeReconciliationSchema.safeParse({
      status: 'completed',
      clearedIds: ['txn-1', 'txn-2', 'txn-3'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts in_progress status', () => {
    const result = completeReconciliationSchema.safeParse({
      status: 'in_progress',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = completeReconciliationSchema.safeParse({
      status: 'cancelled',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty clearedIds array', () => {
    const result = completeReconciliationSchema.safeParse({
      clearedIds: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects clearedIds with empty strings', () => {
    const result = completeReconciliationSchema.safeParse({
      clearedIds: ['txn-1', ''],
    })
    expect(result.success).toBe(false)
  })
})

describe('validateBody with reconciliation schemas', () => {
  it('returns success for valid create', () => {
    const result = validateBody(createReconciliationSchema, {
      account_id: 'acc-1',
      statement_date: '2026-01-31',
      statement_balance: 5000,
    })
    expect(result.success).toBe(true)
  })

  it('returns error for invalid create', () => {
    const result = validateBody(createReconciliationSchema, {})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(400)
    }
  })
})

describe('reconciliation routes use validateBody', () => {
  const mainRoute = readFileSync(
    join(__dirname, '../../app/api/reconciliation/route.ts'),
    'utf-8'
  )
  const idRoute = readFileSync(
    join(__dirname, '../../app/api/reconciliation/[id]/route.ts'),
    'utf-8'
  )

  it('main route imports validateBody and schema', () => {
    expect(mainRoute).toContain('validateBody')
    expect(mainRoute).toContain('createReconciliationSchema')
  })

  it('main route does not use manual validation', () => {
    expect(mainRoute).not.toMatch(/if\s*\(\s*!account_id/)
    expect(mainRoute).not.toMatch(/statement_balance === undefined/)
  })

  it('[id] route imports validateBody and schema', () => {
    expect(idRoute).toContain('validateBody')
    expect(idRoute).toContain('completeReconciliationSchema')
  })

  it('[id] route does not use as any casts', () => {
    expect(idRoute).not.toContain('as any')
  })

  it('[id] route uses typed interfaces', () => {
    expect(idRoute).toContain('ReconciliationSession')
    expect(idRoute).toContain('TransactionRow')
  })
})
