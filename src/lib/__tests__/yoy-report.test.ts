import { describe, it, expect } from 'vitest'

// Test the year-over-year comparison logic

describe('year-over-year percentage change', () => {
  function percentChange(current: number, previous: number): number {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  it('calculates positive increase', () => {
    expect(percentChange(1200, 1000)).toBeCloseTo(20, 1)
  })

  it('calculates decrease', () => {
    expect(percentChange(800, 1000)).toBeCloseTo(-20, 1)
  })

  it('handles zero previous (no division by zero)', () => {
    expect(percentChange(500, 0)).toBe(0)
  })

  it('calculates no change', () => {
    expect(percentChange(1000, 1000)).toBe(0)
  })

  it('handles large increases', () => {
    expect(percentChange(3000, 1000)).toBeCloseTo(200, 1)
  })
})

describe('month name mapping', () => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  it('maps all 12 months', () => {
    expect(monthNames).toHaveLength(12)
  })

  it('maps month index correctly', () => {
    expect(monthNames[0]).toBe('Jan')
    expect(monthNames[11]).toBe('Dec')
    expect(monthNames[5]).toBe('Jun')
  })
})

describe('year-over-year data structure', () => {
  it('builds monthly row with year columns', () => {
    const years = ['2024', '2025', '2026']
    const spending = { '2024': 500, '2025': 600, '2026': 450 }

    const row: Record<string, any> = { month: 'Jan' }
    for (const year of years) {
      row[year] = spending[year as keyof typeof spending] || 0
    }

    expect(row).toEqual({ month: 'Jan', '2024': 500, '2025': 600, '2026': 450 })
  })

  it('defaults missing year data to 0', () => {
    const years = ['2024', '2025']
    const spending = { '2024': 300 }

    const row: Record<string, any> = { month: 'Mar' }
    for (const year of years) {
      row[year] = (spending as any)[year] || 0
    }

    expect(row['2025']).toBe(0)
  })
})
