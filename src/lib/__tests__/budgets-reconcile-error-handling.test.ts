import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const budgetsSource = readFileSync(
  join(__dirname, '../../app/budgets/page.tsx'),
  'utf-8'
)

const reconcileSource = readFileSync(
  join(__dirname, '../../app/reconcile/page.tsx'),
  'utf-8'
)

describe('Budgets page error handling', () => {
  it('checks response.ok in fetchData Promise.all', () => {
    expect(budgetsSource).toContain('Failed to load budgets')
    expect(budgetsSource).toContain('Failed to load categories')
  })

  it('has .catch() on the Promise.all chain', () => {
    const fetchDataBlock = budgetsSource.slice(
      budgetsSource.indexOf('const fetchData'),
      budgetsSource.indexOf('const fetchHistory')
    )
    expect(fetchDataBlock).toContain('.catch(')
  })

  it('checks response.ok in fetchHistory', () => {
    expect(budgetsSource).toContain('Failed to load spending history')
  })

  it('has .catch() on fetchHistory', () => {
    const historyBlock = budgetsSource.slice(
      budgetsSource.indexOf('const fetchHistory'),
      budgetsSource.indexOf('useEffect(() => { fetchData')
    )
    expect(historyBlock).toContain('.catch(')
  })
})

describe('Reconcile page error handling', () => {
  it('checks response.ok for initial accounts fetch', () => {
    expect(reconcileSource).toContain('Failed to load accounts')
  })

  it('checks response.ok for initial sessions fetch', () => {
    expect(reconcileSource).toContain('Failed to load reconciliation sessions')
  })

  it('has error handling in startSession', () => {
    const block = reconcileSource.slice(
      reconcileSource.indexOf('const startSession'),
      reconcileSource.indexOf('const loadSessionTransactions')
    )
    expect(block).toContain('if (!res.ok)')
    expect(block).toContain('catch')
  })

  it('has error handling in loadSessionTransactions', () => {
    const block = reconcileSource.slice(
      reconcileSource.indexOf('const loadSessionTransactions'),
      reconcileSource.indexOf('const toggleCleared')
    )
    expect(block).toContain('if (!res.ok)')
    expect(block).toContain('catch')
  })

  it('has error handling in finishReconciliation', () => {
    const block = reconcileSource.slice(
      reconcileSource.indexOf('const finishReconciliation'),
      reconcileSource.indexOf('const clearedBalance')
    )
    expect(block).toContain('if (!res.ok)')
    expect(block).toContain('catch')
  })
})
