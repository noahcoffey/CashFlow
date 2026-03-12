import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  createRuleSchema,
  updateRuleSchema,
  deleteRuleSchema,
  validateBody,
} from '../validation'

const validCondition = { field: 'description' as const, operator: 'contains' as const, value: 'AMAZON' }
const validAction = { type: 'set_category' as const, value: 'cat-123' }

describe('createRuleSchema', () => {
  it('accepts valid rule with defaults', () => {
    const result = createRuleSchema.safeParse({
      name: 'Amazon purchases',
      conditions: [validCondition],
      actions: [validAction],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(0)
    }
  })

  it('accepts rule with custom priority and retroactive flag', () => {
    const result = createRuleSchema.safeParse({
      name: 'High priority',
      priority: 10,
      conditions: [validCondition],
      actions: [validAction],
      apply_retroactively: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts multiple conditions and actions', () => {
    const result = createRuleSchema.safeParse({
      name: 'Complex rule',
      conditions: [
        validCondition,
        { field: 'amount', operator: 'gt', value: '100' },
      ],
      actions: [
        validAction,
        { type: 'set_display_name', value: 'Amazon' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = createRuleSchema.safeParse({
      conditions: [validCondition],
      actions: [validAction],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty conditions array', () => {
    const result = createRuleSchema.safeParse({
      name: 'No conditions',
      conditions: [],
      actions: [validAction],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty actions array', () => {
    const result = createRuleSchema.safeParse({
      name: 'No actions',
      conditions: [validCondition],
      actions: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid condition field', () => {
    const result = createRuleSchema.safeParse({
      name: 'Bad field',
      conditions: [{ field: 'invalid', operator: 'contains', value: 'x' }],
      actions: [validAction],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid action type', () => {
    const result = createRuleSchema.safeParse({
      name: 'Bad action',
      conditions: [validCondition],
      actions: [{ type: 'invalid', value: 'x' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative priority', () => {
    const result = createRuleSchema.safeParse({
      name: 'Negative',
      priority: -1,
      conditions: [validCondition],
      actions: [validAction],
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid condition operators', () => {
    const operators = ['contains', 'starts_with', 'ends_with', 'equals', 'regex', 'gt', 'lt', 'gte', 'lte', 'between']
    for (const operator of operators) {
      const result = createRuleSchema.safeParse({
        name: `Op ${operator}`,
        conditions: [{ field: 'description', operator, value: 'test' }],
        actions: [validAction],
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid action types', () => {
    const types = ['set_category', 'set_display_name', 'add_tag']
    for (const type of types) {
      const result = createRuleSchema.safeParse({
        name: `Type ${type}`,
        conditions: [validCondition],
        actions: [{ type, value: 'val' }],
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts condition with optional fields', () => {
    const result = createRuleSchema.safeParse({
      name: 'With optionals',
      conditions: [{
        field: 'amount',
        operator: 'between',
        value: '10',
        value2: '100',
        case_sensitive: true,
      }],
      actions: [validAction],
    })
    expect(result.success).toBe(true)
  })
})

describe('updateRuleSchema', () => {
  it('requires id', () => {
    const result = updateRuleSchema.safeParse({ name: 'New name' })
    expect(result.success).toBe(false)
  })

  it('accepts id with no other fields', () => {
    const result = updateRuleSchema.safeParse({ id: 'rule-1' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with conditions', () => {
    const result = updateRuleSchema.safeParse({
      id: 'rule-1',
      conditions: [validCondition],
    })
    expect(result.success).toBe(true)
  })

  it('accepts is_active toggle', () => {
    const result = updateRuleSchema.safeParse({ id: 'rule-1', is_active: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects invalid is_active value', () => {
    const result = updateRuleSchema.safeParse({ id: 'rule-1', is_active: 2 })
    expect(result.success).toBe(false)
  })
})

describe('deleteRuleSchema', () => {
  it('requires id', () => {
    const result = deleteRuleSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts valid id', () => {
    const result = deleteRuleSchema.safeParse({ id: 'rule-1' })
    expect(result.success).toBe(true)
  })
})

describe('validateBody with rule schemas', () => {
  it('returns success with parsed data for valid rule', () => {
    const result = validateBody(createRuleSchema, {
      name: 'Test',
      conditions: [validCondition],
      actions: [validAction],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(0)
      expect(result.data.conditions).toHaveLength(1)
    }
  })

  it('returns error for invalid rule', () => {
    const result = validateBody(createRuleSchema, { name: 'No arrays' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(400)
    }
  })
})

describe('rules route uses validateBody (not manual checks)', () => {
  const source = readFileSync(
    join(__dirname, '../../app/api/rules/route.ts'),
    'utf-8'
  )

  it('imports validateBody and rule schemas', () => {
    expect(source).toContain('validateBody')
    expect(source).toContain('createRuleSchema')
    expect(source).toContain('updateRuleSchema')
    expect(source).toContain('deleteRuleSchema')
  })

  it('does not use manual validation', () => {
    expect(source).not.toMatch(/if\s*\(\s*!name\s*/)
    expect(source).not.toMatch(/if\s*\(\s*!id\s*\)/)
    expect(source).not.toMatch(/if\s*\(\s*!conditions/)
  })

  it('does not use as any casts', () => {
    expect(source).not.toContain('as any')
  })

  it('uses safe JSON parsing', () => {
    expect(source).toContain('safeParseJSON')
  })

  it('preserves retroactive application', () => {
    expect(source).toContain('apply_retroactively')
    expect(source).toContain('applyRulesToTransactions')
  })
})
