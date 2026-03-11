import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema } from '../db'

function setupTestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  return db
}

function getIndexes(db: Database.Database): string[] {
  const rows = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name`
  ).all() as Array<{ name: string }>
  return rows.map(r => r.name)
}

function getIndexColumns(db: Database.Database, indexName: string): string[] {
  const rows = db.prepare(`PRAGMA index_info('${indexName}')`).all() as Array<{ name: string }>
  return rows.map(r => r.name)
}

function explainQuery(db: Database.Database, sql: string, params: any[] = []): string {
  const rows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as Array<{ detail: string }>
  return rows.map(r => r.detail).join(' ')
}

describe('database indexes', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupTestDb()
  })

  afterEach(() => {
    if (db) db.close()
  })

  it('has all expected indexes', () => {
    const indexes = getIndexes(db)
    expect(indexes).toContain('idx_transactions_account')
    expect(indexes).toContain('idx_transactions_date')
    expect(indexes).toContain('idx_transactions_category')
    expect(indexes).toContain('idx_transactions_account_date')
    expect(indexes).toContain('idx_transactions_date_amount')
    expect(indexes).toContain('idx_transactions_reconciled')
    expect(indexes).toContain('idx_categories_parent')
    expect(indexes).toContain('idx_merchant_aliases_pattern')
    expect(indexes).toContain('idx_transaction_splits_txn')
    expect(indexes).toContain('idx_transaction_tags_tag')
    expect(indexes).toContain('idx_scheduled_bills_next_due')
    expect(indexes).toContain('idx_scheduled_bills_active')
  })

  it('composite account_date index covers (account_id, date)', () => {
    const cols = getIndexColumns(db, 'idx_transactions_account_date')
    expect(cols).toEqual(['account_id', 'date'])
  })

  it('composite date_amount index covers (date, amount)', () => {
    const cols = getIndexColumns(db, 'idx_transactions_date_amount')
    expect(cols).toEqual(['date', 'amount'])
  })

  it('reconciled index covers is_reconciled column', () => {
    const cols = getIndexColumns(db, 'idx_transactions_reconciled')
    expect(cols).toEqual(['is_reconciled'])
  })

  it('scheduled_bills active index covers (is_active, next_due_date)', () => {
    const cols = getIndexColumns(db, 'idx_scheduled_bills_active')
    expect(cols).toEqual(['is_active', 'next_due_date'])
  })

  it('query planner uses account_date index for account+date filtering', () => {
    const plan = explainQuery(
      db,
      `SELECT COUNT(*) FROM transactions WHERE account_id = ? AND date >= ? AND date <= ?`,
      ['acc-1', '2025-01-01', '2025-01-31']
    )
    expect(plan).toContain('idx_transactions_account_date')
  })

  it('query planner uses reconciled index for is_reconciled filtering', () => {
    const plan = explainQuery(
      db,
      `SELECT COUNT(*) FROM transactions WHERE is_reconciled = ?`,
      [0]
    )
    expect(plan).toContain('idx_transactions_reconciled')
  })
})
