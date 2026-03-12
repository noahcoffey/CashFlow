import { describe, it, expect } from 'vitest'
import { buildTransactionFilters } from '../transaction-filters'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('buildTransactionFilters', () => {
  it('returns empty WHERE clause with no params', () => {
    const params = new URLSearchParams()
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toBe('')
    expect(result.params).toEqual([])
  })

  it('builds search filter with FTS5 MATCH', () => {
    const params = new URLSearchParams({ search: 'coffee' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toContain('transactions_fts MATCH ?')
    expect(result.params).toEqual(['"coffee"'])
  })

  it('builds accountId filter', () => {
    const params = new URLSearchParams({ accountId: 'acc-1' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toContain('t.account_id = ?')
    expect(result.params).toEqual(['acc-1'])
  })

  it('builds categoryId filter', () => {
    const params = new URLSearchParams({ categoryId: 'cat-1' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toContain('t.category_id = ?')
    expect(result.params).toEqual(['cat-1'])
  })

  it('builds date range filters', () => {
    const params = new URLSearchParams({ startDate: '2025-01-01', endDate: '2025-12-31' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toContain('t.date >= ?')
    expect(result.whereClause).toContain('t.date <= ?')
    expect(result.params).toEqual(['2025-01-01', '2025-12-31'])
  })

  it('builds isReconciled filter for true', () => {
    const params = new URLSearchParams({ isReconciled: 'true' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toContain('t.is_reconciled = ?')
    expect(result.params).toEqual([1])
  })

  it('builds isReconciled filter for false', () => {
    const params = new URLSearchParams({ isReconciled: 'false' })
    const result = buildTransactionFilters(params)
    expect(result.params).toEqual([0])
  })

  it('builds amount range filters', () => {
    const params = new URLSearchParams({ minAmount: '10.50', maxAmount: '100' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toContain('t.amount >= ?')
    expect(result.whereClause).toContain('t.amount <= ?')
    expect(result.params).toEqual([10.50, 100])
  })

  it('builds tagId filter with subquery', () => {
    const params = new URLSearchParams({ tagId: 'tag-1' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toContain('transaction_tags')
    expect(result.params).toEqual(['tag-1'])
  })

  it('combines multiple filters with AND', () => {
    const params = new URLSearchParams({ search: 'food', accountId: 'acc-1', startDate: '2025-01-01' })
    const result = buildTransactionFilters(params)
    expect(result.whereClause).toMatch(/^WHERE .+ AND .+ AND .+$/)
    expect(result.params.length).toBe(3) // 1 for FTS search + 1 accountId + 1 date
  })

  it('returns properly typed params (no any[])', () => {
    const params = new URLSearchParams({ minAmount: '10', search: 'test' })
    const result = buildTransactionFilters(params)
    for (const p of result.params) {
      expect(typeof p === 'string' || typeof p === 'number').toBe(true)
    }
  })
})

describe('Routes use shared filter builder', () => {
  it('transactions route imports buildTransactionFilters', () => {
    const source = readFileSync(
      join(__dirname, '../../app/api/transactions/route.ts'), 'utf-8'
    )
    expect(source).toContain("import { buildTransactionFilters } from '@/lib/transaction-filters'")
    expect(source).toContain('buildTransactionFilters(searchParams)')
  })

  it('export route imports buildTransactionFilters', () => {
    const source = readFileSync(
      join(__dirname, '../../app/api/transactions/export/route.ts'), 'utf-8'
    )
    expect(source).toContain("import { buildTransactionFilters } from '@/lib/transaction-filters'")
    expect(source).toContain('buildTransactionFilters(searchParams)')
  })

  it('transactions route no longer has inline filter building', () => {
    const source = readFileSync(
      join(__dirname, '../../app/api/transactions/route.ts'), 'utf-8'
    )
    // Should not have the old inline params: any[] pattern
    expect(source).not.toContain('params: any[]')
  })

  it('export route no longer has inline filter building', () => {
    const source = readFileSync(
      join(__dirname, '../../app/api/transactions/export/route.ts'), 'utf-8'
    )
    expect(source).not.toContain('params: any[]')
  })
})
