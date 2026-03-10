import Papa from 'papaparse'

export interface ColumnMapping {
  date: string
  description: string
  amount: string
  credit?: string
  debit?: string
}

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
}

interface DetectionResult {
  mapping: ColumnMapping
  format: string
  confidence: number
}

const DATE_PATTERNS = [
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{1,2}-\d{1,2}-\d{2,4}$/,
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,
]

const AMOUNT_PATTERNS = [
  /^-?\$?[\d,]+\.?\d*$/,
  /^\(?\$?[\d,]+\.?\d*\)?$/,
]

const DATE_COLUMN_NAMES = ['date', 'transaction date', 'trans date', 'posting date', 'post date', 'trans_date', 'transaction_date']
const DESC_COLUMN_NAMES = ['description', 'memo', 'payee', 'name', 'merchant', 'details', 'narrative', 'transaction', 'original description']
const AMOUNT_COLUMN_NAMES = ['amount', 'total', 'sum', 'value', 'transaction amount']
const CREDIT_COLUMN_NAMES = ['credit', 'credits', 'deposit', 'deposits', 'credit amount']
const DEBIT_COLUMN_NAMES = ['debit', 'debits', 'withdrawal', 'withdrawals', 'debit amount', 'charge']

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
}

function isDateValue(val: string): boolean {
  return DATE_PATTERNS.some(p => p.test(val.trim()))
}

function isAmountValue(val: string): boolean {
  return AMOUNT_PATTERNS.some(p => p.test(val.trim().replace(/[$,]/g, '')))
}

export function detectColumnMapping(headers: string[], sampleRows: string[][]): DetectionResult {
  const normalized = headers.map(normalizeHeader)

  let mapping: ColumnMapping = { date: '', description: '', amount: '' }
  let format = 'generic'
  let confidence = 0

  // Try header name matching first
  for (const h of normalized) {
    const idx = normalized.indexOf(h)
    const original = headers[idx]

    if (!mapping.date && DATE_COLUMN_NAMES.includes(h)) {
      mapping.date = original
      confidence += 0.3
    }
    if (!mapping.description && DESC_COLUMN_NAMES.includes(h)) {
      mapping.description = original
      confidence += 0.3
    }
    if (!mapping.amount && AMOUNT_COLUMN_NAMES.includes(h)) {
      mapping.amount = original
      confidence += 0.3
    }
    if (!mapping.credit && CREDIT_COLUMN_NAMES.includes(h)) {
      mapping.credit = original
    }
    if (!mapping.debit && DEBIT_COLUMN_NAMES.includes(h)) {
      mapping.debit = original
    }
  }

  // If we have credit/debit but no amount, use them
  if (!mapping.amount && mapping.credit && mapping.debit) {
    confidence += 0.2
  }

  // Fallback: detect by sample data
  if (!mapping.date || !mapping.description) {
    for (let i = 0; i < headers.length; i++) {
      const colValues = sampleRows.map(row => row[i] || '').filter(Boolean)

      if (!mapping.date && colValues.some(isDateValue)) {
        mapping.date = headers[i]
        confidence += 0.15
      }
      if (!mapping.amount && !mapping.credit && colValues.some(isAmountValue)) {
        mapping.amount = headers[i]
        confidence += 0.15
      }
    }
    // Description is typically the longest text column
    if (!mapping.description) {
      let maxAvgLen = 0
      let bestCol = ''
      for (let i = 0; i < headers.length; i++) {
        if (headers[i] === mapping.date || headers[i] === mapping.amount) continue
        const avgLen = sampleRows.reduce((sum, row) => sum + (row[i]?.length || 0), 0) / sampleRows.length
        if (avgLen > maxAvgLen) {
          maxAvgLen = avgLen
          bestCol = headers[i]
        }
      }
      if (bestCol) {
        mapping.description = bestCol
        confidence += 0.1
      }
    }
  }

  // Detect known bank formats
  const headerSet = new Set(normalized)
  if (headerSet.has('details') && headerSet.has('posting date')) format = 'chase'
  else if (headerSet.has('posted date') && headerSet.has('payee')) format = 'bofa'
  else if (headerSet.has('transaction date') && headerSet.has('debit') && headerSet.has('credit')) format = 'capital_one'
  else if (headerSet.has('payee') && headerSet.has('category') && headerSet.has('outflow')) format = 'ynab'
  else if (headerSet.has('original description') && headerSet.has('labels')) format = 'mint'

  return { mapping, format, confidence: Math.min(confidence, 1) }
}

export function parseCSV(csvText: string): { headers: string[]; rows: string[][]; errors: string[] } {
  const result = Papa.parse(csvText, {
    skipEmptyLines: true,
  })

  const errors = result.errors.map((e: any) => e.message)
  const data = result.data as string[][]

  if (data.length < 2) {
    return { headers: [], rows: [], errors: ['CSV must have at least a header row and one data row'] }
  }

  return {
    headers: data[0],
    rows: data.slice(1),
    errors,
  }
}

export function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0
  let cleaned = value.trim().replace(/[$,]/g, '')
  // Handle parenthetical negatives: (123.45) -> -123.45
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export function parseDate(value: string): string {
  const trimmed = value.trim()

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10)
  }

  // Try MM/DD/YYYY or MM-DD-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0')
    const day = slashMatch[2].padStart(2, '0')
    let year = slashMatch[3]
    if (year.length === 2) year = '20' + year
    return `${year}-${month}-${day}`
  }

  // Fallback: try native Date parsing
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10)
  }

  return trimmed
}

export function extractTransactions(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping
): ParsedTransaction[] {
  const dateIdx = headers.indexOf(mapping.date)
  const descIdx = headers.indexOf(mapping.description)
  const amountIdx = mapping.amount ? headers.indexOf(mapping.amount) : -1
  const creditIdx = mapping.credit ? headers.indexOf(mapping.credit) : -1
  const debitIdx = mapping.debit ? headers.indexOf(mapping.debit) : -1

  return rows
    .map(row => {
      const date = dateIdx >= 0 ? parseDate(row[dateIdx] || '') : ''
      const description = descIdx >= 0 ? (row[descIdx] || '').trim() : ''

      let amount = 0
      if (amountIdx >= 0) {
        amount = parseAmount(row[amountIdx] || '')
      } else if (creditIdx >= 0 && debitIdx >= 0) {
        const credit = parseAmount(row[creditIdx] || '')
        const debit = parseAmount(row[debitIdx] || '')
        amount = credit > 0 ? credit : -Math.abs(debit)
      }

      return { date, description, amount }
    })
    .filter(t => t.date && t.description && t.amount !== 0)
}

export function generateFingerprint(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${description.toLowerCase().replace(/\s+/g, ' ').trim()}`
}
