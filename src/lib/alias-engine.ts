import { getDb } from './db'
import { ALIAS_MATCH_THRESHOLD } from './constants'

interface MerchantAlias {
  id: string
  raw_pattern: string
  display_name: string
  category_id: string | null
  match_count: number
}

function normalizeDescription(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\d{4,}/g, '') // remove long numbers (card numbers, dates)
    .replace(/\b\d{2}\/\d{2}\b/g, '') // remove date patterns
    .replace(/[#*]/g, '') // remove special chars
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeDescription(a)
  const normB = normalizeDescription(b)

  // Exact substring match
  if (normA.includes(normB) || normB.includes(normA)) {
    return 1.0
  }

  // Word overlap
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2))
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)))
  const union = new Set([...wordsA, ...wordsB])

  return intersection.size / union.size
}

export function matchAlias(rawDescription: string): MerchantAlias | null {
  const db = getDb()
  const aliases = db.prepare('SELECT * FROM merchant_aliases').all() as MerchantAlias[]

  let bestMatch: MerchantAlias | null = null
  let bestScore = 0

  for (const alias of aliases) {
    const score = calculateSimilarity(rawDescription, alias.raw_pattern)
    if (score > bestScore && score >= ALIAS_MATCH_THRESHOLD) {
      bestScore = score
      bestMatch = alias
    }
  }

  if (bestMatch) {
    db.prepare('UPDATE merchant_aliases SET match_count = match_count + 1 WHERE id = ?')
      .run(bestMatch.id)
  }

  return bestMatch
}

export function applyAliasesToTransactions(transactionIds?: string[]) {
  const db = getDb()

  let transactions
  if (transactionIds) {
    const placeholders = transactionIds.map(() => '?').join(',')
    transactions = db.prepare(
      `SELECT id, raw_description FROM transactions WHERE id IN (${placeholders})`
    ).all(...transactionIds) as { id: string; raw_description: string }[]
  } else {
    transactions = db.prepare(
      `SELECT id, raw_description FROM transactions WHERE display_name = '' OR display_name IS NULL`
    ).all() as { id: string; raw_description: string }[]
  }

  const updateStmt = db.prepare(
    'UPDATE transactions SET display_name = ?, category_id = COALESCE(?, category_id) WHERE id = ?'
  )

  let matched = 0
  const applyAll = db.transaction(() => {
    for (const txn of transactions) {
      const alias = matchAlias(txn.raw_description)
      if (alias) {
        updateStmt.run(alias.display_name, alias.category_id, txn.id)
        matched++
      }
    }
  })
  applyAll()

  return { total: transactions.length, matched }
}

export function createAlias(rawPattern: string, displayName: string, categoryId: string | null): string {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO merchant_aliases (id, raw_pattern, display_name, category_id) VALUES (?, ?, ?, ?)'
  ).run(id, rawPattern, displayName, categoryId)
  return id
}
