import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'cashflow.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initializeSchema(db)
  }
  return db
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit', 'investment')),
      institution TEXT DEFAULT '',
      currency TEXT DEFAULT 'USD',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      color TEXT DEFAULT '#6B7280',
      icon TEXT DEFAULT '📁',
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
      budget_amount REAL DEFAULT 0,
      budget_period TEXT DEFAULT 'monthly' CHECK(budget_period IN ('monthly', 'weekly', 'annual')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
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

    CREATE TABLE IF NOT EXISTS merchant_aliases (
      id TEXT PRIMARY KEY,
      raw_pattern TEXT NOT NULL,
      display_name TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      match_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('monthly', 'weekly', 'annual')),
      start_date TEXT,
      end_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reconciliation_sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      statement_date TEXT NOT NULL,
      statement_balance REAL NOT NULL,
      status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_cache (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_merchant_aliases_pattern ON merchant_aliases(raw_pattern);
  `)

  // Seed default categories if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }
  if (count.count === 0) {
    seedDefaultCategories(db)
  }
}

function seedDefaultCategories(db: Database.Database) {
  const categories = [
    { id: 'cat-food', name: 'Food & Dining', color: '#EF4444', icon: '🍔', type: 'expense', budget: 600 },
    { id: 'cat-groceries', name: 'Groceries', color: '#F97316', icon: '🛒', type: 'expense', budget: 400, parent: 'cat-food' },
    { id: 'cat-restaurants', name: 'Restaurants', color: '#EF4444', icon: '🍽️', type: 'expense', budget: 200, parent: 'cat-food' },
    { id: 'cat-transport', name: 'Transportation', color: '#3B82F6', icon: '🚗', type: 'expense', budget: 300 },
    { id: 'cat-gas', name: 'Gas & Fuel', color: '#2563EB', icon: '⛽', type: 'expense', budget: 150, parent: 'cat-transport' },
    { id: 'cat-housing', name: 'Housing', color: '#8B5CF6', icon: '🏠', type: 'expense', budget: 2000 },
    { id: 'cat-rent', name: 'Rent/Mortgage', color: '#7C3AED', icon: '🏡', type: 'expense', budget: 1500, parent: 'cat-housing' },
    { id: 'cat-utilities', name: 'Utilities', color: '#6D28D9', icon: '💡', type: 'expense', budget: 300, parent: 'cat-housing' },
    { id: 'cat-entertainment', name: 'Entertainment', color: '#EC4899', icon: '🎬', type: 'expense', budget: 200 },
    { id: 'cat-shopping', name: 'Shopping', color: '#F59E0B', icon: '🛍️', type: 'expense', budget: 300 },
    { id: 'cat-health', name: 'Health & Fitness', color: '#10B981', icon: '💪', type: 'expense', budget: 200 },
    { id: 'cat-education', name: 'Education', color: '#06B6D4', icon: '📚', type: 'expense', budget: 100 },
    { id: 'cat-personal', name: 'Personal Care', color: '#F472B6', icon: '💅', type: 'expense', budget: 100 },
    { id: 'cat-insurance', name: 'Insurance', color: '#6366F1', icon: '🛡️', type: 'expense', budget: 300 },
    { id: 'cat-subscriptions', name: 'Subscriptions', color: '#A855F7', icon: '📱', type: 'expense', budget: 100 },
    { id: 'cat-travel', name: 'Travel', color: '#14B8A6', icon: '✈️', type: 'expense', budget: 200 },
    { id: 'cat-gifts', name: 'Gifts & Donations', color: '#F43F5E', icon: '🎁', type: 'expense', budget: 100 },
    { id: 'cat-fees', name: 'Fees & Charges', color: '#64748B', icon: '💸', type: 'expense', budget: 50 },
    { id: 'cat-income', name: 'Income', color: '#22C55E', icon: '💰', type: 'income', budget: 0 },
    { id: 'cat-salary', name: 'Salary', color: '#16A34A', icon: '💵', type: 'income', budget: 0, parent: 'cat-income' },
    { id: 'cat-freelance', name: 'Freelance', color: '#15803D', icon: '💻', type: 'income', budget: 0, parent: 'cat-income' },
    { id: 'cat-transfer', name: 'Transfers', color: '#94A3B8', icon: '🔄', type: 'transfer', budget: 0 },
    { id: 'cat-other', name: 'Uncategorized', color: '#9CA3AF', icon: '❓', type: 'expense', budget: 0 },
  ]

  const stmt = db.prepare(`
    INSERT INTO categories (id, name, parent_id, color, icon, type, budget_amount, budget_period)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'monthly')
  `)

  const insertMany = db.transaction(() => {
    for (const cat of categories) {
      stmt.run(cat.id, cat.name, (cat as any).parent || null, cat.color, cat.icon, cat.type, cat.budget)
    }
  })
  insertMany()
}
