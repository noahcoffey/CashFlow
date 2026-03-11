import { describe, it, expect } from 'vitest'

// Test the pagination clamping logic extracted from the transactions route
function parsePagination(pageStr: string | null, limitStr: string | null): { page: number; limit: number; offset: number } | { error: string } {
  const rawPage = parseInt(pageStr || '1')
  const rawLimit = parseInt(limitStr || '50')

  if (isNaN(rawPage) || isNaN(rawLimit)) {
    return { error: 'page and limit must be valid numbers' }
  }

  const page = Math.max(1, rawPage)
  const limit = Math.min(Math.max(1, rawLimit), 500)
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

describe('pagination parameter validation', () => {
  it('uses defaults when no params provided', () => {
    const result = parsePagination(null, null)
    expect(result).toEqual({ page: 1, limit: 50, offset: 0 })
  })

  it('accepts valid page and limit', () => {
    const result = parsePagination('3', '25')
    expect(result).toEqual({ page: 3, limit: 25, offset: 50 })
  })

  it('clamps page to minimum of 1 for zero', () => {
    const result = parsePagination('0', '50')
    expect(result).toEqual({ page: 1, limit: 50, offset: 0 })
  })

  it('clamps page to minimum of 1 for negative values', () => {
    const result = parsePagination('-5', '50')
    expect(result).toEqual({ page: 1, limit: 50, offset: 0 })
  })

  it('clamps limit to maximum of 500', () => {
    const result = parsePagination('1', '999999')
    expect(result).toEqual({ page: 1, limit: 500, offset: 0 })
  })

  it('clamps limit to minimum of 1', () => {
    const result = parsePagination('1', '0')
    expect(result).toEqual({ page: 1, limit: 1, offset: 0 })
  })

  it('clamps negative limit to 1', () => {
    const result = parsePagination('1', '-10')
    expect(result).toEqual({ page: 1, limit: 1, offset: 0 })
  })

  it('returns error for non-numeric page', () => {
    const result = parsePagination('abc', '50')
    expect(result).toEqual({ error: 'page and limit must be valid numbers' })
  })

  it('returns error for non-numeric limit', () => {
    const result = parsePagination('1', 'xyz')
    expect(result).toEqual({ error: 'page and limit must be valid numbers' })
  })

  it('calculates correct offset for higher pages', () => {
    const result = parsePagination('5', '20')
    expect(result).toEqual({ page: 5, limit: 20, offset: 80 })
  })

  it('handles limit of exactly 500', () => {
    const result = parsePagination('1', '500')
    expect(result).toEqual({ page: 1, limit: 500, offset: 0 })
  })
})
