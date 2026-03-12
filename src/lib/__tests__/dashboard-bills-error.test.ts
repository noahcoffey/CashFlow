import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(
  join(__dirname, '../../app/dashboard/page.tsx'),
  'utf-8'
)

describe('Dashboard bills fetch error handling', () => {
  it('checks response.ok before parsing bills JSON', () => {
    expect(source).toContain('if (!r.ok) throw new Error("Failed to load bills")')
  })

  it('has a billsError state', () => {
    expect(source).toContain('billsError')
    expect(source).toContain('setBillsError')
  })

  it('sets billsError in the catch handler', () => {
    expect(source).toContain('setBillsError(err.message)')
  })

  it('displays billsError with an AlertCircle icon', () => {
    expect(source).toContain('{billsError}')
  })

  it('shows bills error state before the bills list', () => {
    const errorIdx = source.indexOf('billsError ?')
    const listIdx = source.indexOf('bills.length > 0')
    expect(errorIdx).toBeGreaterThan(0)
    expect(errorIdx).toBeLessThan(listIdx)
  })
})
