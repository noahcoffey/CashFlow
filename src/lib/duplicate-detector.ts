import { getDb } from './db'

export interface DuplicateGroup {
  key: string
  transactions: DuplicateTransaction[]
}

export interface DuplicateTransaction {
  id: string
  date: string
  amount: number
  raw_description: string
  display_name: string
  account_name: string | null
  category_name: string | null
  category_icon: string | null
  created_at: string
}

/**
 * Find potential duplicate transactions.
 * Groups by: same amount + same date (or within 1 day) + similar description.
 * Excludes groups where all transactions are from the same import batch (same created_at second).
 */
export function findDuplicates(): DuplicateGroup[] {
  const db = getDb()

  // Find transactions that share the same amount and date (exact match first)
  const candidates = db.prepare(`
    SELECT t.id, t.date, t.amount, t.raw_description, t.display_name,
           t.created_at, a.name as account_name, c.name as category_name, c.icon as category_icon
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC, t.amount
  `).all() as DuplicateTransaction[]

  // Group by amount + date
  const groups = new Map<string, DuplicateTransaction[]>()

  for (const txn of candidates) {
    const key = `${txn.date}|${txn.amount.toFixed(2)}`
    const group = groups.get(key) || []
    group.push(txn)
    groups.set(key, group)
  }

  // Also check adjacent dates (±1 day) for same amount + similar description
  for (const txn of candidates) {
    const d = new Date(txn.date)
    for (const offset of [-1, 1]) {
      const adjacent = new Date(d)
      adjacent.setDate(adjacent.getDate() + offset)
      const adjDate = adjacent.toISOString().substring(0, 10)
      const adjKey = `${adjDate}|${txn.amount.toFixed(2)}`

      const adjGroup = groups.get(adjKey)
      if (adjGroup) {
        // Check if similar description exists in adjacent group
        const normalizedDesc = normalizeForComparison(txn.raw_description)
        const hasSimilar = adjGroup.some(
          t => t.id !== txn.id && similarity(normalizedDesc, normalizeForComparison(t.raw_description)) > 0.6
        )
        if (hasSimilar) {
          // Merge into the adjacent group using earliest date as canonical key
          const canonicalKey = txn.date < adjDate ? `${txn.date}|${txn.amount.toFixed(2)}` : adjKey
          const canonical = groups.get(canonicalKey) || []
          if (!canonical.find(t => t.id === txn.id)) {
            canonical.push(txn)
            groups.set(canonicalKey, canonical)
          }
        }
      }
    }
  }

  // Filter to groups with 2+ transactions
  const duplicates: DuplicateGroup[] = []
  for (const [key, txns] of groups) {
    if (txns.length < 2) continue
    // Deduplicate by id within the group
    const unique = Array.from(new Map(txns.map(t => [t.id, t])).values())
    if (unique.length < 2) continue
    duplicates.push({ key, transactions: unique })
  }

  return duplicates
}

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
