import { describe, it, expect } from 'vitest'
import {
  RECONCILIATION_TOLERANCE,
  BUDGET_WARNING_THRESHOLD,
  BUDGET_OVER_THRESHOLD,
  RECURRING_CONFIDENCE_THRESHOLD,
  ALIAS_MATCH_THRESHOLD,
} from '../constants'

describe('shared constants', () => {
  it('exports RECONCILIATION_TOLERANCE as a small positive number', () => {
    expect(RECONCILIATION_TOLERANCE).toBe(0.01)
    expect(RECONCILIATION_TOLERANCE).toBeGreaterThan(0)
  })

  it('exports budget thresholds with warning < over', () => {
    expect(BUDGET_WARNING_THRESHOLD).toBe(75)
    expect(BUDGET_OVER_THRESHOLD).toBe(100)
    expect(BUDGET_WARNING_THRESHOLD).toBeLessThan(BUDGET_OVER_THRESHOLD)
  })

  it('exports RECURRING_CONFIDENCE_THRESHOLD between 0 and 1', () => {
    expect(RECURRING_CONFIDENCE_THRESHOLD).toBe(0.8)
    expect(RECURRING_CONFIDENCE_THRESHOLD).toBeGreaterThan(0)
    expect(RECURRING_CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(1)
  })

  it('exports ALIAS_MATCH_THRESHOLD between 0 and 1', () => {
    expect(ALIAS_MATCH_THRESHOLD).toBe(0.5)
    expect(ALIAS_MATCH_THRESHOLD).toBeGreaterThan(0)
    expect(ALIAS_MATCH_THRESHOLD).toBeLessThanOrEqual(1)
  })
})

describe('pages use shared constants (not magic numbers)', () => {
  const fs = require('fs')
  const path = require('path')

  it('reconcile page imports RECONCILIATION_TOLERANCE', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app/reconcile/page.tsx'), 'utf-8'
    )
    expect(source).toContain('RECONCILIATION_TOLERANCE')
    expect(source).not.toMatch(/Math\.abs\(difference\)\s*<\s*0\.01/)
    expect(source).not.toMatch(/Math\.abs\(difference\)\s*>=\s*0\.01/)
  })

  it('budgets page imports BUDGET thresholds', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app/budgets/page.tsx'), 'utf-8'
    )
    expect(source).toContain('BUDGET_WARNING_THRESHOLD')
    expect(source).toContain('BUDGET_OVER_THRESHOLD')
    expect(source).not.toMatch(/pct > 100\b/)
    expect(source).not.toMatch(/pct > 75\b/)
  })

  it('subscriptions page imports RECURRING_CONFIDENCE_THRESHOLD', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app/subscriptions/page.tsx'), 'utf-8'
    )
    expect(source).toContain('RECURRING_CONFIDENCE_THRESHOLD')
    expect(source).not.toMatch(/confidence >= 0\.8/)
  })

  it('alias engine imports ALIAS_MATCH_THRESHOLD', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../alias-engine.ts'), 'utf-8'
    )
    expect(source).toContain('ALIAS_MATCH_THRESHOLD')
    expect(source).not.toMatch(/const THRESHOLD = 0\.5/)
  })
})
