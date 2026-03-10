import { getDb } from './db'

export interface RuleCondition {
  field: 'description' | 'amount' | 'account'
  operator: 'contains' | 'starts_with' | 'ends_with' | 'equals' | 'regex' | 'gt' | 'lt' | 'gte' | 'lte' | 'between'
  value: string
  value2?: string // for 'between' operator
  case_sensitive?: boolean
}

export interface RuleAction {
  type: 'set_category' | 'set_display_name' | 'add_tag'
  value: string
}

export interface CategorizationRule {
  id: string
  name: string
  priority: number
  conditions: RuleCondition[]
  actions: RuleAction[]
  is_active: number
  match_count: number
}

interface Transaction {
  id: string
  raw_description: string
  display_name: string
  amount: number
  account_id: string
}

export function evaluateCondition(condition: RuleCondition, txn: Transaction): boolean {
  const { field, operator, value, value2, case_sensitive } = condition

  if (field === 'amount') {
    const amt = txn.amount
    const v = parseFloat(value)
    switch (operator) {
      case 'gt': return amt > v
      case 'lt': return amt < v
      case 'gte': return amt >= v
      case 'lte': return amt <= v
      case 'between': return amt >= v && amt <= parseFloat(value2 || '0')
      case 'equals': return Math.abs(amt - v) < 0.01
      default: return false
    }
  }

  if (field === 'account') {
    return txn.account_id === value
  }

  // description field
  const desc = case_sensitive ? txn.raw_description : txn.raw_description.toLowerCase()
  const target = case_sensitive ? value : value.toLowerCase()

  switch (operator) {
    case 'contains': return desc.includes(target)
    case 'starts_with': return desc.startsWith(target)
    case 'ends_with': return desc.endsWith(target)
    case 'equals': return desc === target
    case 'regex': {
      try {
        const flags = case_sensitive ? '' : 'i'
        return new RegExp(value, flags).test(txn.raw_description)
      } catch {
        return false
      }
    }
    default: return false
  }
}

export function evaluateRule(rule: CategorizationRule, txn: Transaction): boolean {
  // All conditions must match (AND logic)
  return rule.conditions.every(c => evaluateCondition(c, txn))
}

export function applyRulesToTransactions(transactionIds?: string[]) {
  const db = getDb()

  const rules = db.prepare(
    `SELECT * FROM categorization_rules WHERE is_active = 1 ORDER BY priority DESC`
  ).all() as CategorizationRule[]

  if (rules.length === 0) return { total: 0, matched: 0, ruleMatches: {} as Record<string, number> }

  // Parse JSON fields
  for (const rule of rules) {
    rule.conditions = JSON.parse(rule.conditions as unknown as string)
    rule.actions = JSON.parse(rule.actions as unknown as string)
  }

  let transactions: Transaction[]
  if (transactionIds) {
    const placeholders = transactionIds.map(() => '?').join(',')
    transactions = db.prepare(
      `SELECT id, raw_description, display_name, amount, account_id FROM transactions WHERE id IN (${placeholders})`
    ).all(...transactionIds) as Transaction[]
  } else {
    transactions = db.prepare(
      `SELECT id, raw_description, display_name, amount, account_id FROM transactions`
    ).all() as Transaction[]
  }

  const updateCategory = db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?')
  const updateDisplayName = db.prepare('UPDATE transactions SET display_name = ? WHERE id = ?')
  const updateMatchCount = db.prepare('UPDATE categorization_rules SET match_count = match_count + ? WHERE id = ?')

  // Check if tag tables exist for add_tag action
  const insertTag = db.prepare('INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)')

  let matched = 0
  const ruleMatches: Record<string, number> = {}

  const applyAll = db.transaction(() => {
    for (const txn of transactions) {
      for (const rule of rules) {
        if (evaluateRule(rule, txn)) {
          for (const action of rule.actions) {
            switch (action.type) {
              case 'set_category':
                updateCategory.run(action.value, txn.id)
                break
              case 'set_display_name':
                updateDisplayName.run(action.value, txn.id)
                break
              case 'add_tag':
                insertTag.run(txn.id, action.value)
                break
            }
          }
          matched++
          ruleMatches[rule.id] = (ruleMatches[rule.id] || 0) + 1
          break // first matching rule wins (priority-based)
        }
      }
    }

    // Update match counts
    for (const [ruleId, count] of Object.entries(ruleMatches)) {
      updateMatchCount.run(count, ruleId)
    }
  })
  applyAll()

  return { total: transactions.length, matched, ruleMatches }
}
