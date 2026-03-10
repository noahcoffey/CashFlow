import { describe, it, expect } from 'vitest'
import { escapeCSVField, toCSV } from '../csv-export'

describe('escapeCSVField', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCSVField('hello')).toBe('hello')
  })

  it('wraps values with commas in quotes', () => {
    expect(escapeCSVField('hello, world')).toBe('"hello, world"')
  })

  it('wraps values with quotes and escapes inner quotes', () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps values with newlines', () => {
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('handles empty string', () => {
    expect(escapeCSVField('')).toBe('')
  })
})

describe('toCSV', () => {
  it('generates valid CSV with headers and rows', () => {
    const csv = toCSV(
      ['Date', 'Description', 'Amount'],
      [
        ['2026-03-09', 'STARBUCKS', '-5.50'],
        ['2026-03-10', 'GROCERY STORE', '-42.00'],
      ]
    )
    expect(csv).toBe('Date,Description,Amount\r\n2026-03-09,STARBUCKS,-5.50\r\n2026-03-10,GROCERY STORE,-42.00\r\n')
  })

  it('escapes fields with special characters', () => {
    const csv = toCSV(
      ['Name', 'Value'],
      [['Has, comma', 'Has "quotes"']]
    )
    expect(csv).toBe('Name,Value\r\n"Has, comma","Has ""quotes"""\r\n')
  })

  it('handles empty rows', () => {
    const csv = toCSV(['A', 'B'], [])
    expect(csv).toBe('A,B\r\n')
  })
})
