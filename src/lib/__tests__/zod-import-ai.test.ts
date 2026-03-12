import { describe, it, expect } from 'vitest'
import {
  importBodySchema,
  aiQuerySchema,
  aiForecastItemSchema,
  aiForecastResponseSchema,
} from '../validation'
import { readFileSync } from 'fs'
import { join } from 'path'

// --- Import schema tests ---
describe('importBodySchema', () => {
  it('accepts valid import body', () => {
    const result = importBodySchema.safeParse({
      accountId: 'acc-1',
      transactions: [
        { date: '2024-01-15', amount: -50.00, raw_description: 'Grocery Store' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing accountId', () => {
    const result = importBodySchema.safeParse({
      transactions: [{ date: '2024-01-15', amount: -50, raw_description: 'Test' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty transactions array', () => {
    const result = importBodySchema.safeParse({
      accountId: 'acc-1',
      transactions: [],
    })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].message).toContain('At least one transaction')
  })

  it('rejects transactions missing required fields', () => {
    const result = importBodySchema.safeParse({
      accountId: 'acc-1',
      transactions: [{ date: '2024-01-15' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects transactions with empty description', () => {
    const result = importBodySchema.safeParse({
      accountId: 'acc-1',
      transactions: [{ date: '2024-01-15', amount: -10, raw_description: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-finite amount', () => {
    const result = importBodySchema.safeParse({
      accountId: 'acc-1',
      transactions: [{ date: '2024-01-15', amount: Infinity, raw_description: 'Test' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts multiple valid transactions', () => {
    const result = importBodySchema.safeParse({
      accountId: 'acc-1',
      transactions: [
        { date: '2024-01-15', amount: -50, raw_description: 'Store A' },
        { date: '2024-01-16', amount: 1000, raw_description: 'Payroll' },
        { date: '2024-01-17', amount: -25.99, raw_description: 'Store B' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

// --- AI query schema tests ---
describe('aiQuerySchema', () => {
  it('accepts valid question', () => {
    const result = aiQuerySchema.safeParse({ question: 'How much did I spend last month?' })
    expect(result.success).toBe(true)
  })

  it('rejects empty question', () => {
    const result = aiQuerySchema.safeParse({ question: '' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].message).toContain('question is required')
  })

  it('rejects missing question field', () => {
    const result = aiQuerySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects non-string question', () => {
    const result = aiQuerySchema.safeParse({ question: 123 })
    expect(result.success).toBe(false)
  })

  it('rejects question over 2000 chars', () => {
    const result = aiQuerySchema.safeParse({ question: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('accepts question at max length', () => {
    const result = aiQuerySchema.safeParse({ question: 'a'.repeat(2000) })
    expect(result.success).toBe(true)
  })
})

// --- AI forecast response schema tests ---
describe('aiForecastResponseSchema', () => {
  it('accepts valid forecast response', () => {
    const result = aiForecastResponseSchema.safeParse([
      {
        category: 'Groceries',
        projected_amount: 450.00,
        confidence: 'high',
        reasoning: 'Consistent spending pattern',
      },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts multiple forecast items', () => {
    const result = aiForecastResponseSchema.safeParse([
      { category: 'Groceries', projected_amount: 450, confidence: 'high', reasoning: 'Stable' },
      { category: 'Dining', projected_amount: 200, confidence: 'medium', reasoning: 'Varies' },
      { category: 'Gas', projected_amount: 100, confidence: 'low', reasoning: 'Unpredictable' },
    ])
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(3)
  })

  it('rejects invalid confidence level', () => {
    const result = aiForecastItemSchema.safeParse({
      category: 'Test',
      projected_amount: 100,
      confidence: 'very_high',
      reasoning: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing category', () => {
    const result = aiForecastItemSchema.safeParse({
      projected_amount: 100,
      confidence: 'high',
      reasoning: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing projected_amount', () => {
    const result = aiForecastItemSchema.safeParse({
      category: 'Test',
      confidence: 'high',
      reasoning: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-array input', () => {
    const result = aiForecastResponseSchema.safeParse({
      category: 'Test',
      projected_amount: 100,
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty array', () => {
    const result = aiForecastResponseSchema.safeParse([])
    expect(result.success).toBe(true)
  })
})

// --- Source-level route verification ---
describe('Import route uses validateBody', () => {
  const source = readFileSync(
    join(__dirname, '../../app/api/import/route.ts'),
    'utf-8'
  )

  it('imports validateBody and importBodySchema', () => {
    expect(source).toContain('importBodySchema')
    expect(source).toContain('validateBody')
  })

  it('calls validateBody with importBodySchema', () => {
    expect(source).toContain('validateBody(importBodySchema')
  })
})

describe('AI query route uses validateBody', () => {
  const source = readFileSync(
    join(__dirname, '../../app/api/ai/query/route.ts'),
    'utf-8'
  )

  it('imports validateBody and aiQuerySchema', () => {
    expect(source).toContain('aiQuerySchema')
    expect(source).toContain('validateBody')
  })

  it('calls validateBody with aiQuerySchema', () => {
    expect(source).toContain('validateBody(aiQuerySchema')
  })

  it('uses error: unknown instead of error: any', () => {
    expect(source).toContain('error: unknown')
    expect(source).not.toContain('error: any')
  })
})

describe('AI forecast route validates response schema', () => {
  const source = readFileSync(
    join(__dirname, '../../app/api/ai/forecast/route.ts'),
    'utf-8'
  )

  it('imports aiForecastResponseSchema', () => {
    expect(source).toContain('aiForecastResponseSchema')
  })

  it('validates extracted JSON against schema', () => {
    expect(source).toContain('aiForecastResponseSchema.safeParse')
  })

  it('uses error: unknown instead of error: any', () => {
    expect(source).toContain('error: unknown')
    expect(source).not.toContain('error: any')
  })
})
