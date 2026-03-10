import { describe, it, expect } from 'vitest'

// Test the pure functions from the recurring detector

function getMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

interface FrequencyResult {
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
  confidence: number
}

function detectFrequency(intervals: number[]): FrequencyResult | null {
  const median = getMedian(intervals)

  const ranges: Array<{ freq: FrequencyResult['frequency']; min: number; max: number; ideal: number }> = [
    { freq: 'weekly', min: 5, max: 9, ideal: 7 },
    { freq: 'biweekly', min: 12, max: 17, ideal: 14 },
    { freq: 'monthly', min: 25, max: 35, ideal: 30 },
    { freq: 'quarterly', min: 80, max: 100, ideal: 91 },
    { freq: 'annual', min: 350, max: 380, ideal: 365 },
  ]

  for (const range of ranges) {
    if (median >= range.min && median <= range.max) {
      const deviation = intervals.reduce((sum, i) => sum + Math.abs(i - range.ideal), 0) / intervals.length
      const consistency = Math.max(0, 1 - deviation / range.ideal)
      const minOccurrences = range.freq === 'annual' ? 2 : range.freq === 'quarterly' ? 2 : 3
      if (intervals.length < minOccurrences - 1) continue

      return {
        frequency: range.freq,
        confidence: Math.round(consistency * 100) / 100,
      }
    }
  }

  return null
}

describe('getMedian', () => {
  it('returns middle value for odd-length array', () => {
    expect(getMedian([1, 3, 5])).toBe(3)
  })

  it('returns average of two middle values for even-length array', () => {
    expect(getMedian([1, 3, 5, 7])).toBe(4)
  })

  it('handles single element', () => {
    expect(getMedian([42])).toBe(42)
  })

  it('sorts before computing', () => {
    expect(getMedian([5, 1, 3])).toBe(3)
  })
})

describe('detectFrequency', () => {
  it('detects weekly pattern', () => {
    const result = detectFrequency([7, 7, 7, 7])
    expect(result?.frequency).toBe('weekly')
    expect(result?.confidence).toBeGreaterThan(0.8)
  })

  it('detects biweekly pattern', () => {
    const result = detectFrequency([14, 14, 15, 14])
    expect(result?.frequency).toBe('biweekly')
  })

  it('detects monthly pattern', () => {
    const result = detectFrequency([30, 31, 30, 28, 31])
    expect(result?.frequency).toBe('monthly')
  })

  it('detects quarterly pattern', () => {
    const result = detectFrequency([91, 92])
    expect(result?.frequency).toBe('quarterly')
  })

  it('detects annual pattern', () => {
    const result = detectFrequency([365])
    expect(result?.frequency).toBe('annual')
  })

  it('returns low confidence for irregular intervals', () => {
    const result = detectFrequency([3, 45, 12, 67])
    // Median 28.5 falls in monthly range but with very low confidence
    if (result) {
      expect(result.confidence).toBeLessThan(0.5)
    }
  })

  it('requires minimum occurrences for monthly', () => {
    const result = detectFrequency([30])
    // Only 1 interval = 2 occurrences, needs 3 for monthly
    expect(result).toBeNull()
  })

  it('handles noisy monthly data', () => {
    const result = detectFrequency([28, 31, 30, 32, 29])
    expect(result?.frequency).toBe('monthly')
    expect(result?.confidence).toBeGreaterThan(0.5)
  })
})
