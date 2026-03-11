import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'

/**
 * Integration tests that exercise the same SQL operations used by API routes
 * against a real SQLite database with the full CashFlow schema.
 */

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
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
    CREATE TABLE budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('monthly', 'weekly', 'annual')),
      start_date TEXT,
      end_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_transactions_account ON transactions(account_id);
    CREATE INDEX idx_transactions_category ON transactions(category_id);
    CREATE INDEX idx_transaction_tags_tag ON transaction_tags(tag_id);
  `)
  return db
}

describe('accounts CRUD', () => {
  let db: Database.Database

  beforeEach(() => { db = createTestDb() })
  afterEach(() => { db.close() })

  it('creates an account with all fields', () => {
    db.prepare('INSERT INTO accounts (id, name, type, institution, currency) VALUES (?, ?, ?, ?, ?)')
      .run('acc-1', 'Chase Checking', 'checking', 'Chase', 'USD')

    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get('acc-1') as any
    expect(acc.name).toBe('Chase Checking')
    expect(acc.type).toBe('checking')
    expect(acc.institution).toBe('Chase')
    expect(acc.currency).toBe('USD')
  })

  it('rejects invalid account type via CHECK constraint', () => {
    expect(() => {
      db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Test', 'bitcoin')
    }).toThrow()
  })

  it('updates account fields', () => {
    db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Old Name', 'checking')

    db.prepare('UPDATE accounts SET name = COALESCE(?, name), type = COALESCE(?, type) WHERE id = ?')
      .run('New Name', null, 'acc-1')

    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get('acc-1') as any
    expect(acc.name).toBe('New Name')
    expect(acc.type).toBe('checking') // unchanged
  })

  it('deletes an account', () => {
    db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Test', 'checking')
    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run('acc-1')
    expect(result.changes).toBe(1)

    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get('acc-1')
    expect(acc).toBeUndefined()
  })

  it('cascades delete to transactions when account is deleted', () => {
    db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Test', 'checking')
    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, ?, ?, ?, ?)")
      .run('txn-1', 'acc-1', '2026-03-01', -50, 'Test txn')

    db.prepare('DELETE FROM accounts WHERE id = ?').run('acc-1')

    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('txn-1')
    expect(txn).toBeUndefined()
  })
})

describe('transactions CRUD', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
    db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Checking', 'checking')
    db.prepare("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)").run('cat-1', 'Food', 'expense')
  })
  afterEach(() => { db.close() })

  it('creates a transaction with all fields', () => {
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description, display_name, category_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('txn-1', 'acc-1', '2026-03-15', -42.50, 'STARBUCKS #1234', 'Starbucks', 'cat-1', 'Morning coffee')

    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('txn-1') as any
    expect(txn.amount).toBe(-42.50)
    expect(txn.raw_description).toBe('STARBUCKS #1234')
    expect(txn.display_name).toBe('Starbucks')
    expect(txn.category_id).toBe('cat-1')
    expect(txn.is_reconciled).toBe(0)
  })

  it('rejects transaction with nonexistent account_id', () => {
    expect(() => {
      db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, ?, ?, ?, ?)")
        .run('txn-1', 'nonexistent', '2026-03-15', -10, 'Test')
    }).toThrow()
  })

  it('sets category_id to NULL when category is deleted', () => {
    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description, category_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run('txn-1', 'acc-1', '2026-03-15', -10, 'Test', 'cat-1')

    db.prepare('DELETE FROM categories WHERE id = ?').run('cat-1')

    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('txn-1') as any
    expect(txn.category_id).toBeNull()
  })

  it('updates transaction fields with COALESCE', () => {
    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, ?, ?, ?, ?)")
      .run('txn-1', 'acc-1', '2026-03-15', -50, 'Original')

    db.prepare(`UPDATE transactions SET
        amount = COALESCE(?, amount),
        is_reconciled = COALESCE(?, is_reconciled)
       WHERE id = ?`)
      .run(-75, 1, 'txn-1')

    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('txn-1') as any
    expect(txn.amount).toBe(-75)
    expect(txn.is_reconciled).toBe(1)
  })

  it('deletes a transaction', () => {
    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, ?, ?, ?, ?)")
      .run('txn-1', 'acc-1', '2026-03-15', -50, 'Test')

    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run('txn-1')
    expect(result.changes).toBe(1)
  })

  it('returns 0 changes when deleting nonexistent transaction', () => {
    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run('nonexistent')
    expect(result.changes).toBe(0)
  })

  it('fetches transactions with joined category and account data', () => {
    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description, category_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run('txn-1', 'acc-1', '2026-03-15', -10, 'Test', 'cat-1')

    const txn = db.prepare(`
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `).get('txn-1') as any

    expect(txn.category_name).toBe('Food')
    expect(txn.account_name).toBe('Checking')
  })
})

describe('tags and transaction_tags', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
    db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Checking', 'checking')
    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, ?, ?, ?, ?)")
      .run('txn-1', 'acc-1', '2026-03-15', -50, 'Test')
  })
  afterEach(() => { db.close() })

  it('creates a tag', () => {
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run('tag-1', 'tax-deductible', '#22C55E')
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get('tag-1') as any
    expect(tag.name).toBe('tax-deductible')
  })

  it('enforces unique tag names', () => {
    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run('tag-1', 'unique-name')
    expect(() => {
      db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run('tag-2', 'unique-name')
    }).toThrow(/UNIQUE constraint/)
  })

  it('associates tags with transactions', () => {
    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run('tag-1', 'business')
    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run('tag-2', 'tax')
    db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)').run('txn-1', 'tag-1')
    db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)').run('txn-1', 'tag-2')

    const tags = db.prepare(`
      SELECT tg.id, tg.name FROM transaction_tags tt
      JOIN tags tg ON tt.tag_id = tg.id
      WHERE tt.transaction_id = ?
    `).all('txn-1') as any[]

    expect(tags).toHaveLength(2)
    expect(tags.map(t => t.name).sort()).toEqual(['business', 'tax'])
  })

  it('cascades delete: removing transaction removes its tags', () => {
    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run('tag-1', 'test')
    db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)').run('txn-1', 'tag-1')

    db.prepare('DELETE FROM transactions WHERE id = ?').run('txn-1')

    const links = db.prepare('SELECT * FROM transaction_tags WHERE transaction_id = ?').all('txn-1')
    expect(links).toHaveLength(0)

    // Tag itself should still exist
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get('tag-1')
    expect(tag).toBeTruthy()
  })

  it('cascades delete: removing tag removes its transaction links', () => {
    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run('tag-1', 'test')
    db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)').run('txn-1', 'tag-1')

    db.prepare('DELETE FROM tags WHERE id = ?').run('tag-1')

    const links = db.prepare('SELECT * FROM transaction_tags WHERE tag_id = ?').all('tag-1')
    expect(links).toHaveLength(0)
  })
})

describe('budgets', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
    db.prepare("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)").run('cat-1', 'Food', 'expense')
    db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Checking', 'checking')
  })
  afterEach(() => { db.close() })

  it('creates a budget for a category', () => {
    db.prepare('INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)')
      .run('bud-1', 'cat-1', 500, 'monthly')

    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get('bud-1') as any
    expect(budget.amount).toBe(500)
    expect(budget.period).toBe('monthly')
  })

  it('rejects invalid budget period', () => {
    expect(() => {
      db.prepare('INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)')
        .run('bud-1', 'cat-1', 500, 'daily')
    }).toThrow()
  })

  it('cascades delete: removing category removes its budget', () => {
    db.prepare('INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)')
      .run('bud-1', 'cat-1', 500, 'monthly')

    db.prepare('DELETE FROM categories WHERE id = ?').run('cat-1')

    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get('bud-1')
    expect(budget).toBeUndefined()
  })

  it('calculates budget utilization with spending query', () => {
    db.prepare('INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)')
      .run('bud-1', 'cat-1', 500, 'monthly')

    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description, category_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run('txn-1', 'acc-1', '2026-03-15', -120, 'Groceries', 'cat-1')
    db.prepare("INSERT INTO transactions (id, account_id, date, amount, raw_description, category_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run('txn-2', 'acc-1', '2026-03-16', -80, 'Restaurant', 'cat-1')

    const result = db.prepare(`
      SELECT b.amount as budgeted,
             COALESCE(
               (SELECT SUM(ABS(t.amount)) FROM transactions t
                WHERE t.category_id = b.category_id
                  AND t.date >= '2026-03-01' AND t.date <= '2026-03-31'
                  AND t.amount < 0),
               0
             ) as spent
      FROM budgets b WHERE b.id = ?
    `).get('bud-1') as any

    expect(result.budgeted).toBe(500)
    expect(result.spent).toBe(200)
  })
})

describe('categories with parent hierarchy', () => {
  let db: Database.Database

  beforeEach(() => { db = createTestDb() })
  afterEach(() => { db.close() })

  it('creates parent and child categories', () => {
    db.prepare("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)").run('parent', 'Food', 'expense')
    db.prepare("INSERT INTO categories (id, name, type, parent_id) VALUES (?, ?, ?, ?)").run('child', 'Restaurants', 'expense', 'parent')

    const child = db.prepare(`
      SELECT c.*, p.name as parent_name
      FROM categories c LEFT JOIN categories p ON c.parent_id = p.id
      WHERE c.id = ?
    `).get('child') as any

    expect(child.parent_name).toBe('Food')
    expect(child.parent_id).toBe('parent')
  })

  it('sets parent_id to NULL when parent category is deleted', () => {
    db.prepare("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)").run('parent', 'Food', 'expense')
    db.prepare("INSERT INTO categories (id, name, type, parent_id) VALUES (?, ?, ?, ?)").run('child', 'Restaurants', 'expense', 'parent')

    db.prepare('DELETE FROM categories WHERE id = ?').run('parent')

    const child = db.prepare('SELECT * FROM categories WHERE id = ?').get('child') as any
    expect(child.parent_id).toBeNull()
  })
})

describe('multi-step workflow: import → categorize → reconcile', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
    db.prepare('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)').run('acc-1', 'Checking', 'checking')
    db.prepare("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)").run('cat-food', 'Food', 'expense')
    db.prepare("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)").run('cat-income', 'Income', 'income')
  })
  afterEach(() => { db.close() })

  it('simulates a full import → categorize → reconcile workflow', () => {
    // Step 1: Bulk import transactions (simulating CSV import)
    const insertTxn = db.prepare(`
      INSERT INTO transactions (id, account_id, date, amount, raw_description)
      VALUES (?, ?, ?, ?, ?)
    `)
    const importBatch = db.transaction(() => {
      insertTxn.run('txn-1', 'acc-1', '2026-03-01', 5000, 'PAYROLL DEPOSIT')
      insertTxn.run('txn-2', 'acc-1', '2026-03-05', -42.50, 'STARBUCKS #1234')
      insertTxn.run('txn-3', 'acc-1', '2026-03-10', -156.78, 'WHOLE FOODS MKT')
      insertTxn.run('txn-4', 'acc-1', '2026-03-15', -89.00, 'AMAZON.COM')
    })
    importBatch()

    const count = db.prepare('SELECT COUNT(*) as c FROM transactions').get() as any
    expect(count.c).toBe(4)

    // Step 2: Categorize transactions
    db.prepare('UPDATE transactions SET category_id = ?, display_name = ? WHERE id = ?')
      .run('cat-income', 'Payroll', 'txn-1')
    db.prepare('UPDATE transactions SET category_id = ?, display_name = ? WHERE id = ?')
      .run('cat-food', 'Starbucks', 'txn-2')
    db.prepare('UPDATE transactions SET category_id = ?, display_name = ? WHERE id = ?')
      .run('cat-food', 'Whole Foods', 'txn-3')

    // Step 3: Reconcile — mark matching transactions
    db.prepare('UPDATE transactions SET is_reconciled = 1 WHERE id IN (?, ?, ?)')
      .run('txn-1', 'txn-2', 'txn-3')

    // Verify final state
    const reconciled = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE is_reconciled = 1').get() as any
    expect(reconciled.c).toBe(3)

    const unreconciled = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE is_reconciled = 0').get() as any
    expect(unreconciled.c).toBe(1)

    // Verify account balance
    const balance = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ?')
      .get('acc-1') as any
    expect(balance.total).toBeCloseTo(5000 - 42.50 - 156.78 - 89.00, 2)

    // Verify category spending
    const foodSpending = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transactions WHERE category_id = ? AND amount < 0
    `).get('cat-food') as any
    expect(foodSpending.total).toBeCloseTo(42.50 + 156.78, 2)
  })
})
