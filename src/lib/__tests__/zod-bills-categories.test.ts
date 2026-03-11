import { describe, it, expect } from 'vitest'
import {
  createBillSchema, updateBillSchema, deleteBillSchema,
  createCategorySchema, updateCategorySchema, deleteCategorySchema,
  validateBody,
} from '../validation'

describe('bill Zod schemas', () => {
  describe('createBillSchema', () => {
    it('accepts valid bill data', () => {
      const result = createBillSchema.safeParse({
        name: 'Netflix', amount: -15.99, frequency: 'monthly', next_due_date: '2026-04-01',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing name', () => {
      const result = createBillSchema.safeParse({
        amount: -15.99, frequency: 'monthly', next_due_date: '2026-04-01',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid frequency', () => {
      const result = createBillSchema.safeParse({
        name: 'Netflix', amount: -15.99, frequency: 'daily', next_due_date: '2026-04-01',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid date format', () => {
      const result = createBillSchema.safeParse({
        name: 'Netflix', amount: -15.99, frequency: 'monthly', next_due_date: '04/01/2026',
      })
      expect(result.success).toBe(false)
    })

    it('accepts optional category_id and account_id', () => {
      const result = createBillSchema.safeParse({
        name: 'Netflix', amount: -15.99, frequency: 'monthly', next_due_date: '2026-04-01',
        category_id: 'cat-1', account_id: 'acc-1',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('updateBillSchema', () => {
    it('requires id', () => {
      const result = updateBillSchema.safeParse({ name: 'Updated' })
      expect(result.success).toBe(false)
    })

    it('accepts id with optional fields', () => {
      const result = updateBillSchema.safeParse({ id: 'bill-1', name: 'Updated', is_active: 0 })
      expect(result.success).toBe(true)
    })
  })

  describe('deleteBillSchema', () => {
    it('requires id', () => {
      const result = deleteBillSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('accepts valid id', () => {
      const result = deleteBillSchema.safeParse({ id: 'bill-1' })
      expect(result.success).toBe(true)
    })
  })
})

describe('category Zod schemas', () => {
  describe('createCategorySchema', () => {
    it('accepts valid category with name and type', () => {
      const result = createCategorySchema.safeParse({ name: 'Food', type: 'expense' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.color).toBe('#6B7280')
        expect(result.data.icon).toBe('📁')
        expect(result.data.budget_amount).toBe(0)
        expect(result.data.budget_period).toBe('monthly')
      }
    })

    it('rejects missing name', () => {
      const result = createCategorySchema.safeParse({ type: 'expense' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid type', () => {
      const result = createCategorySchema.safeParse({ name: 'Food', type: 'other' })
      expect(result.success).toBe(false)
    })

    it('rejects negative budget_amount', () => {
      const result = createCategorySchema.safeParse({
        name: 'Food', type: 'expense', budget_amount: -100,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateCategorySchema', () => {
    it('requires id', () => {
      const result = updateCategorySchema.safeParse({ name: 'Updated' })
      expect(result.success).toBe(false)
    })

    it('accepts id with optional fields', () => {
      const result = updateCategorySchema.safeParse({
        id: 'cat-1', name: 'Updated', color: '#FF0000',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('deleteCategorySchema', () => {
    it('requires id', () => {
      expect(deleteCategorySchema.safeParse({}).success).toBe(false)
    })

    it('accepts valid id', () => {
      expect(deleteCategorySchema.safeParse({ id: 'cat-1' }).success).toBe(true)
    })
  })
})

describe('validateBody helper with new schemas', () => {
  it('returns success with parsed data for valid bill', () => {
    const result = validateBody(createBillSchema, {
      name: 'Netflix', amount: -15.99, frequency: 'monthly', next_due_date: '2026-04-01',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Netflix')
    }
  })

  it('returns error for invalid category', () => {
    const result = validateBody(createCategorySchema, { name: '', type: 'invalid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
      expect(result.status).toBe(400)
    }
  })
})
