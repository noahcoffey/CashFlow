import { getDb } from './db'

export interface RecurringPattern {
  merchant: string
  amount: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
  confidence: number
  lastDate: string
  nextExpected: string
  occurrences: number
  totalAnnual: number
  transactionIds: string[]
}

interface TxnRow {
  id: string
  date: string
  amount: number
  display_name: string
  raw_description: string
}

/**
 * Detect recurring transactions by grouping similar transactions
 * and analyzing their date intervals.
 */
export function detectRecurring(): RecurringPattern[] {
  const db = getDb()

  const transactions = db.prepare(`
    SELECT id, date, amount, display_name, raw_description
    FROM transactions
    WHERE amount < 0
    ORDER BY date ASC
  `).all() as TxnRow[]

  // Group by normalized merchant name + similar amount
  const groups = new Map<string, TxnRow[]>()

  for (const txn of transactions) {
    const merchant = normalizeMerchant(txn.display_name || txn.raw_description)
    if (!merchant) continue
    // Group key: merchant + rounded amount (within 10%)
    const amountBucket = Math.round(Math.abs(txn.amount))
    const key = `${merchant}|${amountBucket}`
    const group = groups.get(key) || []
    group.push(txn)
    groups.set(key, group)
  }

  const patterns: RecurringPattern[] = []

  for (const [, txns] of groups) {
    if (txns.length < 2) continue

    // Sort by date
    const sorted = txns.sort((a, b) => a.date.localeCompare(b.date))

    // Calculate intervals in days between consecutive transactions
    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date)
      const d2 = new Date(sorted[i].date)
      const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
      if (days > 0) intervals.push(days)
    }

    if (intervals.length === 0) continue

    const detected = detectFrequency(intervals)
    if (!detected) continue

    const avgAmount = sorted.reduce((s, t) => s + Math.abs(t.amount), 0) / sorted.length
    const lastDate = sorted[sorted.length - 1].date
    const nextExpected = getNextExpected(lastDate, detected.frequency)

    const multiplier = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, annual: 1 }

    patterns.push({
      merchant: sorted[0].display_name || normalizeMerchant(sorted[0].raw_description),
      amount: -avgAmount,
      frequency: detected.frequency,
      confidence: detected.confidence,
      lastDate,
      nextExpected,
      occurrences: sorted.length,
      totalAnnual: avgAmount * multiplier[detected.frequency],
      transactionIds: sorted.map(t => t.id),
    })
  }

  // Sort by annual cost descending
  return patterns
    .filter(p => p.confidence >= 0.5)
    .sort((a, b) => b.totalAnnual - a.totalAnnual)
}

function normalizeMerchant(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\d{4,}/g, '')
    .replace(/[#*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30)
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
      // Calculate confidence based on how consistent the intervals are
      const deviation = intervals.reduce((sum, i) => sum + Math.abs(i - range.ideal), 0) / intervals.length
      const consistency = Math.max(0, 1 - deviation / range.ideal)
      // Need at least some consistency and enough occurrences
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

function getMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function getNextExpected(lastDate: string, frequency: string): string {
  const d = new Date(lastDate)
  const daysToAdd = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 91, annual: 365 }
  d.setDate(d.getDate() + (daysToAdd[frequency as keyof typeof daysToAdd] || 30))
  return d.toISOString().substring(0, 10)
}
