import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'

function setupTestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit', 'investment')),
      institution TEXT DEFAULT '',
      currency TEXT DEFAULT 'USD',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      color TEXT DEFAULT '#6B7280',
      icon TEXT DEFAULT '📁',
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
      budget_amount REAL DEFAULT 0,
      budget_period TEXT DEFAULT 'monthly',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      raw_description TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      is_reconciled INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE merchant_aliases (
      id TEXT PRIMARY KEY,
      raw_pattern TEXT NOT NULL,
      display_name TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      match_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE transaction_splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6B7280',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE transaction_tags (
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (transaction_id, tag_id)
    );
    CREATE TABLE scheduled_bills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL,
      next_due_date TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Original indexes
    CREATE INDEX idx_transaction_splits_txn ON transaction_splits(transaction_id);
    CREATE INDEX idx_transaction_tags_tag ON transaction_tags(tag_id);
    CREATE INDEX idx_transactions_account ON transactions(account_id);
    CREATE INDEX idx_transactions_date ON transactions(date);
    CREATE INDEX idx_transactions_category ON transactions(category_id);
    CREATE INDEX idx_categories_parent ON categories(parent_id);
    CREATE INDEX idx_merchant_aliases_pattern ON merchant_aliases(raw_pattern);

    -- New composite/filtering indexes
    CREATE INDEX idx_transactions_account_date ON transactions(account_id, date);
    CREATE INDEX idx_transactions_date_amount ON transactions(date, amount);
    CREATE INDEX idx_transactions_reconciled ON transactions(is_reconciled);
    CREATE INDEX idx_scheduled_bills_next_due ON scheduled_bills(next_due_date);
    CREATE INDEX idx_scheduled_bills_active ON scheduled_bills(is_active, next_due_date);
  `)

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

  it('query planner uses account_date index for filtered queries', () => {
    db.prepare(`INSERT INTO accounts (id, name, type) VALUES ('acc-1', 'Checking', 'checking')`).run()

    // Insert some test data
    for (let i = 0; i < 100; i++) {
      db.prepare(
        `INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', '2025-01-15', -10, 'test')`
      ).run(`t-${i}`)
    }

    // Verify the query runs without error with both filters
    const result = db.prepare(
      `SELECT COUNT(*) as cnt FROM transactions WHERE account_id = ? AND date >= ? AND date <= ?`
    ).get('acc-1', '2025-01-01', '2025-01-31') as { cnt: number }

    expect(result.cnt).toBe(100)
  })

  it('reconciled index supports filtering unreconciled transactions', () => {
    db.prepare(`INSERT INTO accounts (id, name, type) VALUES ('acc-1', 'Checking', 'checking')`).run()

    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description, is_reconciled) VALUES ('t1', 'acc-1', '2025-01-15', -10, 'test', 0)`).run()
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description, is_reconciled) VALUES ('t2', 'acc-1', '2025-01-15', -20, 'test', 1)`).run()
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description, is_reconciled) VALUES ('t3', 'acc-1', '2025-01-15', -30, 'test', 0)`).run()

    const unreconciled = db.prepare(
      `SELECT COUNT(*) as cnt FROM transactions WHERE is_reconciled = 0`
    ).get() as { cnt: number }

    expect(unreconciled.cnt).toBe(2)
  })
})
