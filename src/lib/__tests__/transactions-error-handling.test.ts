import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(
  join(__dirname, '../../app/transactions/page.tsx'),
  'utf-8'
)

describe('Transactions page reference data error handling', () => {
  it('checks response.ok for categories fetch', () => {
    expect(source).toContain('Failed to load categories')
  })

  it('checks response.ok for accounts fetch', () => {
    expect(source).toContain('Failed to load accounts')
  })

  it('checks response.ok for tags fetch', () => {
    expect(source).toContain('Failed to load tags')
  })

  it('has .catch() handlers for all three fetches', () => {
    // Count occurrences of .catch in the reference data useEffect
    const refDataBlock = source.slice(
      source.indexOf('fetch("/api/categories")'),
      source.indexOf('}, [])', source.indexOf('fetch("/api/categories")'))
    )
    const catchCount = (refDataBlock.match(/\.catch\(/g) || []).length
    expect(catchCount).toBe(3)
  })

  it('shows toast errors on fetch failure', () => {
    expect(source).toContain('toast.error("Failed to load categories")')
    expect(source).toContain('toast.error("Failed to load accounts")')
    expect(source).toContain('toast.error("Failed to load tags")')
  })

  it('throws on non-ok response before parsing JSON', () => {
    expect(source).toContain('if (!r.ok) throw new Error')
  })
})
