import { describe, it, expect } from 'vitest'

// Test the pure utility functions extracted from the module
// We can't test findDuplicates directly without a DB, so test the matching logic

function normalizeForComparison(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\d{4,}/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  const wordsA = new Set(a.split(' ').filter(w => w.length > 2))
  const wordsB = new Set(b.split(' ').filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union
}

describe('normalizeForComparison', () => {
  it('uppercases text', () => {
    expect(normalizeForComparison('starbucks')).toBe('STARBUCKS')
  })

  it('strips long numbers (card numbers, refs)', () => {
    expect(normalizeForComparison('POS 1234567890 STARBUCKS')).toBe('POS STARBUCKS')
  })

  it('strips special characters', () => {
    expect(normalizeForComparison('STAR*BUCKS #123')).toBe('STARBUCKS 123')
  })

  it('collapses whitespace', () => {
    expect(normalizeForComparison('STAR   BUCKS')).toBe('STAR BUCKS')
  })
})

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('STARBUCKS', 'STARBUCKS')).toBe(1)
  })

  it('returns 0.9 for substring match', () => {
    expect(similarity('STARBUCKS COFFEE', 'STARBUCKS')).toBe(0.9)
  })

  it('returns high score for shared words', () => {
    const a = normalizeForComparison('POS DEBIT STARBUCKS STORE 42')
    const b = normalizeForComparison('POS DEBIT STARBUCKS STORE 43')
    expect(similarity(a, b)).toBeGreaterThan(0.6)
  })

  it('returns low score for unrelated descriptions', () => {
    const a = normalizeForComparison('STARBUCKS COFFEE')
    const b = normalizeForComparison('WALMART GROCERY')
    expect(similarity(a, b)).toBeLessThan(0.3)
  })

  it('returns 0 when words are too short', () => {
    expect(similarity('A B', 'C D')).toBe(0)
  })
})
