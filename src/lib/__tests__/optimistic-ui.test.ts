import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(
  join(__dirname, '../../app/transactions/page.tsx'),
  'utf-8'
)

describe('Optimistic UI updates in transactions page', () => {
  describe('deleteTransaction', () => {
    it('removes transaction from local state before API call', () => {
      // Should filter out the transaction optimistically
      expect(source).toContain('setTransactions(t => t.filter(txn => txn.id !== id))')
    })

    it('decrements total count optimistically', () => {
      expect(source).toContain('setTotal(t => t - 1)')
    })

    it('rolls back on API failure', () => {
      // Should restore previous transactions on error
      const deleteBlock = source.slice(
        source.indexOf('const deleteTransaction'),
        source.indexOf('const bulkDelete')
      )
      expect(deleteBlock).toContain('const prev = transactions')
      expect(deleteBlock).toContain('setTransactions(prev)')
      expect(deleteBlock).toContain('toast.error("Failed to delete transaction")')
    })
  })

  describe('bulkDelete', () => {
    it('filters out selected transactions optimistically', () => {
      expect(source).toContain('setTransactions(t => t.filter(txn => !selected.has(txn.id)))')
    })

    it('rolls back on API failure', () => {
      const bulkDeleteBlock = source.slice(
        source.indexOf('const bulkDelete'),
        source.indexOf('const saveSplits')
      )
      expect(bulkDeleteBlock).toContain('const prev = transactions')
      expect(bulkDeleteBlock).toContain('setTransactions(prev)')
      expect(bulkDeleteBlock).toContain('toast.error("Failed to delete transactions")')
    })
  })

  describe('bulkCategorize', () => {
    it('updates category in local state optimistically', () => {
      expect(source).toContain('category_id: bulkCategoryId, category_name: cat?.name')
    })

    it('rolls back on API failure', () => {
      const block = source.slice(
        source.indexOf('const bulkCategorize'),
        source.indexOf('const deleteTransaction')
      )
      expect(block).toContain('const prev = transactions')
      expect(block).toContain('setTransactions(prev)')
      expect(block).toContain('toast.error("Failed to categorize transactions")')
    })
  })

  describe('toggleTag', () => {
    it('updates tags in local state optimistically', () => {
      const block = source.slice(
        source.indexOf('const toggleTag'),
        source.indexOf('const exportCSV')
      )
      expect(block).toContain('setTransactions(t => t.map(txn =>')
    })

    it('rolls back on API failure', () => {
      const block = source.slice(
        source.indexOf('const toggleTag'),
        source.indexOf('const exportCSV')
      )
      expect(block).toContain('const prev = transactions')
      expect(block).toContain('setTransactions(prev)')
      expect(block).toContain('toast.error("Failed to update tag")')
    })
  })

  describe('bulkTag', () => {
    it('adds tag to selected transactions optimistically', () => {
      const block = source.slice(
        source.indexOf('const bulkTag'),
        source.indexOf('const toggleTag')
      )
      expect(block).toContain('setTransactions(t => t.map(txn =>')
    })

    it('rolls back on API failure', () => {
      const block = source.slice(
        source.indexOf('const bulkTag'),
        source.indexOf('const toggleTag')
      )
      expect(block).toContain('const prev = transactions')
      expect(block).toContain('setTransactions(prev)')
      expect(block).toContain('toast.error("Failed to tag transactions")')
    })
  })

  it('does not call fetchTransactions after optimistic operations', () => {
    // After optimistic update, these functions should NOT refetch
    const deleteBlock = source.slice(
      source.indexOf('const deleteTransaction'),
      source.indexOf('const bulkDelete')
    )
    // fetchTransactions should not appear in the delete function body
    // (the 'prev = transactions' captures state, so no refetch needed)
    const fetchCallsInDelete = (deleteBlock.match(/fetchTransactions\(\)/g) || []).length
    expect(fetchCallsInDelete).toBe(0)
  })
})
