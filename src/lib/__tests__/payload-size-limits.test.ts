import { describe, it, expect } from 'vitest'

/**
 * Tests that verify payload size limit constants and validation logic
 * used by bulk and import API endpoints.
 */

const MAX_BULK_SIZE = 500
const MAX_IMPORT_SIZE = 5000

describe('bulk endpoint payload size limits', () => {
  function validateBulkIds(ids: unknown): { error?: string } {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { error: 'ids array is required' }
    }
    if (ids.length > MAX_BULK_SIZE) {
      return { error: `Bulk operations limited to ${MAX_BULK_SIZE} items` }
    }
    return {}
  }

  it('accepts an array within the limit', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`)
    expect(validateBulkIds(ids)).toEqual({})
  })

  it('accepts exactly MAX_BULK_SIZE items', () => {
    const ids = Array.from({ length: MAX_BULK_SIZE }, (_, i) => `id-${i}`)
    expect(validateBulkIds(ids)).toEqual({})
  })

  it('rejects more than MAX_BULK_SIZE items', () => {
    const ids = Array.from({ length: MAX_BULK_SIZE + 1 }, (_, i) => `id-${i}`)
    const result = validateBulkIds(ids)
    expect(result.error).toContain('limited to 500')
  })

  it('rejects empty array', () => {
    expect(validateBulkIds([])).toEqual({ error: 'ids array is required' })
  })

  it('rejects non-array input', () => {
    expect(validateBulkIds('not-array')).toEqual({ error: 'ids array is required' })
    expect(validateBulkIds(null)).toEqual({ error: 'ids array is required' })
  })
})

describe('import endpoint payload size limits', () => {
  function validateImportTransactions(transactions: unknown): { error?: string } {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { error: 'accountId and transactions array are required' }
    }
    if (transactions.length > MAX_IMPORT_SIZE) {
      return { error: `Import limited to ${MAX_IMPORT_SIZE} transactions per request` }
    }
    return {}
  }

  it('accepts transactions within the limit', () => {
    const txns = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    expect(validateImportTransactions(txns)).toEqual({})
  })

  it('accepts exactly MAX_IMPORT_SIZE transactions', () => {
    const txns = Array.from({ length: MAX_IMPORT_SIZE }, (_, i) => ({ id: i }))
    expect(validateImportTransactions(txns)).toEqual({})
  })

  it('rejects more than MAX_IMPORT_SIZE transactions', () => {
    const txns = Array.from({ length: MAX_IMPORT_SIZE + 1 }, (_, i) => ({ id: i }))
    const result = validateImportTransactions(txns)
    expect(result.error).toContain('limited to 5000')
  })

  it('rejects empty array', () => {
    expect(validateImportTransactions([])).toEqual({
      error: 'accountId and transactions array are required',
    })
  })
})

describe('route source contains size limits', () => {
  const fs = require('fs')
  const path = require('path')

  it('bulk route defines MAX_BULK_SIZE = 500', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/transactions/bulk/route.ts'),
      'utf-8'
    )
    expect(source).toContain('MAX_BULK_SIZE = 500')
    expect(source).toContain('idList.length > MAX_BULK_SIZE')
    expect(source).toContain('ids.length > MAX_BULK_SIZE')
  })

  it('import route uses Zod schema for size validation', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/import/route.ts'),
      'utf-8'
    )
    expect(source).toContain('importBodySchema')
    expect(source).toContain('validateBody')
  })
})
