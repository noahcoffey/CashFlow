import { describe, it, expect } from 'vitest'
import { parseDate, parseAmount, detectColumnMapping, generateFingerprint, extractTransactions } from '../csv-parser'

describe('parseDate', () => {
  it('parses ISO format', () => {
    expect(parseDate('2026-03-09')).toBe('2026-03-09')
  })

  it('parses ISO with time suffix', () => {
    expect(parseDate('2026-03-09T12:00:00')).toBe('2026-03-09')
  })

  it('parses MM/DD/YYYY', () => {
    expect(parseDate('03/09/2026')).toBe('2026-03-09')
  })

  it('parses M/D/YYYY', () => {
    expect(parseDate('3/9/2026')).toBe('2026-03-09')
  })

  it('parses MM-DD-YYYY', () => {
    expect(parseDate('03-09-2026')).toBe('2026-03-09')
  })

  it('parses MM/DD/YY with 2-digit year', () => {
    expect(parseDate('03/09/26')).toBe('2026-03-09')
  })

  it('parses MM.DD.YYYY', () => {
    expect(parseDate('03.09.2026')).toBe('2026-03-09')
  })

  it('trims whitespace', () => {
    expect(parseDate('  03/09/2026  ')).toBe('2026-03-09')
  })

  it('returns raw value for unparseable input', () => {
    expect(parseDate('not-a-date')).toBe('not-a-date')
  })
})

describe('parseAmount', () => {
  it('parses positive number', () => {
    expect(parseAmount('123.45')).toBe(123.45)
  })

  it('parses negative number', () => {
    expect(parseAmount('-123.45')).toBe(-123.45)
  })

  it('strips dollar sign', () => {
    expect(parseAmount('$123.45')).toBe(123.45)
  })

  it('strips commas', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
  })

  it('handles parenthetical negatives', () => {
    expect(parseAmount('(123.45)')).toBe(-123.45)
  })

  it('handles dollar sign with parenthetical', () => {
    expect(parseAmount('($1,234.56)')).toBe(-1234.56)
  })

  it('returns 0 for empty string', () => {
    expect(parseAmount('')).toBe(0)
  })

  it('returns 0 for non-numeric', () => {
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('detectColumnMapping', () => {
  it('detects standard column names', () => {
    const headers = ['Date', 'Description', 'Amount']
    const sampleRows = [['03/09/2026', 'STARBUCKS', '-5.50']]
    const result = detectColumnMapping(headers, sampleRows)
    expect(result.mapping.date).toBe('Date')
    expect(result.mapping.description).toBe('Description')
    expect(result.mapping.amount).toBe('Amount')
  })

  it('detects credit/debit split columns', () => {
    const headers = ['Date', 'Description', 'Debit', 'Credit']
    const sampleRows = [['03/09/2026', 'STARBUCKS', '5.50', '']]
    const result = detectColumnMapping(headers, sampleRows)
    expect(result.mapping.date).toBe('Date')
    expect(result.mapping.debit).toBe('Debit')
    expect(result.mapping.credit).toBe('Credit')
  })

  it('detects Chase format', () => {
    const headers = ['Details', 'Posting Date', 'Description', 'Amount']
    const sampleRows = [['DEBIT', '03/09/2026', 'STARBUCKS', '-5.50']]
    const result = detectColumnMapping(headers, sampleRows)
    expect(result.format).toBe('chase')
  })

  it('falls back to data sampling when headers are ambiguous', () => {
    const headers = ['Col A', 'Col B', 'Col C']
    const sampleRows = [
      ['03/09/2026', 'STARBUCKS COFFEE SHOP', '-5.50'],
      ['03/10/2026', 'GROCERY STORE PURCHASE', '-42.00'],
    ]
    const result = detectColumnMapping(headers, sampleRows)
    expect(result.mapping.date).toBe('Col A')
  })
})

describe('generateFingerprint', () => {
  it('creates consistent fingerprints', () => {
    const fp = generateFingerprint('2026-03-09', -5.50, 'STARBUCKS')
    expect(fp).toBe('2026-03-09|-5.50|starbucks')
  })

  it('normalizes whitespace in description', () => {
    const fp = generateFingerprint('2026-03-09', -5.50, '  STAR  BUCKS  ')
    expect(fp).toBe('2026-03-09|-5.50|star bucks')
  })
})

describe('extractTransactions', () => {
  it('extracts with single amount column', () => {
    const headers = ['Date', 'Description', 'Amount']
    const rows = [['03/09/2026', 'STARBUCKS', '-5.50']]
    const mapping = { date: 'Date', description: 'Description', amount: 'Amount' }
    const txns = extractTransactions(rows, headers, mapping)
    expect(txns).toHaveLength(1)
    expect(txns[0].amount).toBe(-5.5)
    expect(txns[0].date).toBe('2026-03-09')
  })

  it('extracts with credit/debit split', () => {
    const headers = ['Date', 'Description', 'Debit', 'Credit']
    const rows = [
      ['03/09/2026', 'STARBUCKS', '5.50', ''],
      ['03/10/2026', 'PAYCHECK', '', '3000'],
    ]
    const mapping = { date: 'Date', description: 'Description', amount: '', credit: 'Credit', debit: 'Debit' }
    const txns = extractTransactions(rows, headers, mapping)
    expect(txns).toHaveLength(2)
    expect(txns[0].amount).toBe(-5.5)
    expect(txns[1].amount).toBe(3000)
  })

  it('filters out rows with zero amount', () => {
    const headers = ['Date', 'Description', 'Amount']
    const rows = [['03/09/2026', 'STARBUCKS', '0']]
    const mapping = { date: 'Date', description: 'Description', amount: 'Amount' }
    const txns = extractTransactions(rows, headers, mapping)
    expect(txns).toHaveLength(0)
  })
})
