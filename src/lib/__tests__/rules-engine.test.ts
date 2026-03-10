import { describe, it, expect } from 'vitest'
import { evaluateCondition, evaluateRule, type RuleCondition, type RuleAction, type CategorizationRule } from '../rules-engine'

const baseTxn = {
  id: 'txn-1',
  raw_description: 'STARBUCKS STORE #12345 SEATTLE WA',
  display_name: '',
  amount: -5.75,
  account_id: 'acc-1',
}

describe('evaluateCondition - description field', () => {
  it('matches contains (case insensitive)', () => {
    const cond: RuleCondition = { field: 'description', operator: 'contains', value: 'starbucks' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('does not match contains with wrong value', () => {
    const cond: RuleCondition = { field: 'description', operator: 'contains', value: 'walmart' }
    expect(evaluateCondition(cond, baseTxn)).toBe(false)
  })

  it('matches starts_with', () => {
    const cond: RuleCondition = { field: 'description', operator: 'starts_with', value: 'STARBUCKS' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches ends_with', () => {
    const cond: RuleCondition = { field: 'description', operator: 'ends_with', value: 'WA' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches equals', () => {
    const cond: RuleCondition = { field: 'description', operator: 'equals', value: baseTxn.raw_description }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches regex', () => {
    const cond: RuleCondition = { field: 'description', operator: 'regex', value: 'STORE #\\d+' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('handles invalid regex gracefully', () => {
    const cond: RuleCondition = { field: 'description', operator: 'regex', value: '[invalid' }
    expect(evaluateCondition(cond, baseTxn)).toBe(false)
  })

  it('respects case_sensitive flag', () => {
    const cond: RuleCondition = { field: 'description', operator: 'contains', value: 'starbucks', case_sensitive: true }
    expect(evaluateCondition(cond, baseTxn)).toBe(false)
  })
})

describe('evaluateCondition - amount field', () => {
  it('matches gt', () => {
    const cond: RuleCondition = { field: 'amount', operator: 'gt', value: '-10' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches lt', () => {
    const cond: RuleCondition = { field: 'amount', operator: 'lt', value: '0' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches lte', () => {
    const cond: RuleCondition = { field: 'amount', operator: 'lte', value: '-5.75' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches gte', () => {
    const cond: RuleCondition = { field: 'amount', operator: 'gte', value: '-5.75' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches equals within tolerance', () => {
    const cond: RuleCondition = { field: 'amount', operator: 'equals', value: '-5.75' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('matches between', () => {
    const cond: RuleCondition = { field: 'amount', operator: 'between', value: '-10', value2: '0' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('does not match between when outside range', () => {
    const cond: RuleCondition = { field: 'amount', operator: 'between', value: '-5', value2: '0' }
    expect(evaluateCondition(cond, baseTxn)).toBe(false)
  })
})

describe('evaluateCondition - account field', () => {
  it('matches correct account', () => {
    const cond: RuleCondition = { field: 'account', operator: 'equals', value: 'acc-1' }
    expect(evaluateCondition(cond, baseTxn)).toBe(true)
  })

  it('does not match wrong account', () => {
    const cond: RuleCondition = { field: 'account', operator: 'equals', value: 'acc-2' }
    expect(evaluateCondition(cond, baseTxn)).toBe(false)
  })
})

describe('evaluateRule', () => {
  it('matches when all conditions pass (AND logic)', () => {
    const rule: CategorizationRule = {
      id: 'r1', name: 'test', priority: 0, is_active: 1, match_count: 0,
      conditions: [
        { field: 'description', operator: 'contains', value: 'starbucks' },
        { field: 'amount', operator: 'lt', value: '0' },
      ],
      actions: [{ type: 'set_category', value: 'cat-food' }],
    }
    expect(evaluateRule(rule, baseTxn)).toBe(true)
  })

  it('fails when any condition fails', () => {
    const rule: CategorizationRule = {
      id: 'r1', name: 'test', priority: 0, is_active: 1, match_count: 0,
      conditions: [
        { field: 'description', operator: 'contains', value: 'starbucks' },
        { field: 'amount', operator: 'gt', value: '0' },
      ],
      actions: [{ type: 'set_category', value: 'cat-food' }],
    }
    expect(evaluateRule(rule, baseTxn)).toBe(false)
  })

  it('matches single condition rule', () => {
    const rule: CategorizationRule = {
      id: 'r1', name: 'test', priority: 0, is_active: 1, match_count: 0,
      conditions: [{ field: 'description', operator: 'contains', value: 'seattle' }],
      actions: [{ type: 'set_display_name', value: 'Starbucks' }],
    }
    expect(evaluateRule(rule, baseTxn)).toBe(true)
  })
})
