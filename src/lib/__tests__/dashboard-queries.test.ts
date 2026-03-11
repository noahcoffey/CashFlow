import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

function setupTestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      institution TEXT DEFAULT '',
      currency TEXT DEFAULT 'USD',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      color TEXT DEFAULT '#6B7280',
      icon TEXT DEFAULT '📁',
      type TEXT NOT NULL,
      budget_amount REAL DEFAULT 0,
      budget_period TEXT DEFAULT 'monthly',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      raw_description TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      category_id TEXT,
      is_reconciled INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  db.prepare(`INSERT INTO accounts (id, name, type) VALUES ('acc-1', 'Checking', 'checking')`).run()
  db.prepare(`INSERT INTO categories (id, name, type, color, icon) VALUES ('cat-food', 'Food', 'expense', '#EF4444', '🍔')`).run()
  db.prepare(`INSERT INTO categories (id, name, type, color, icon) VALUES ('cat-income', 'Income', 'income', '#22C55E', '💰')`).run()
  db.prepare(`INSERT INTO categories (id, name, type, color, icon) VALUES ('cat-shop', 'Shopping', 'expense', '#F59E0B', '🛍️')`).run()

  return db
}

// Mirrors the optimized dashboard query logic
function runDashboardQueries(db: Database.Database) {
  const now = new Date()
  const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const lastMonth = subMonths(now, 1)
  const lastMonthStart = format(startOfMonth(lastMonth), 'yyyy-MM-dd')
  const lastMonthEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd')
  const sixMonthsAgoStart = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')

  const monthlySummary = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND amount < 0 THEN ABS(amount) END), 0) as monthly_spending,
       COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND amount < 0 THEN ABS(amount) END), 0) as last_month_spending,
       COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND amount > 0 THEN amount END), 0) as monthly_income
     FROM transactions
     WHERE date >= ? AND date <= ?`
  ).get(
    thisMonthStart, thisMonthEnd,
    lastMonthStart, lastMonthEnd,
    thisMonthStart, thisMonthEnd,
    lastMonthStart, thisMonthEnd
  ) as { monthly_spending: number; last_month_spending: number; monthly_income: number }

  const cashFlowRows = db.prepare(
    `SELECT strftime('%Y-%m', date) as month,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) as income,
            COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END), 0) as expenses
     FROM transactions
     WHERE date >= ? AND date <= ?
     GROUP BY strftime('%Y-%m', date)
     ORDER BY month`
  ).all(sixMonthsAgoStart, thisMonthEnd) as Array<{ month: string; income: number; expenses: number }>

  const cashFlowMap = new Map(cashFlowRows.map(r => [r.month, r]))
  const cashFlowByMonth = []
  for (let i = 5; i >= 0; i--) {
    const label = format(subMonths(now, i), 'yyyy-MM')
    const row = cashFlowMap.get(label)
    cashFlowByMonth.push({
      month: label,
      income: row?.income ?? 0,
      expenses: row?.expenses ?? 0,
    })
  }

  return { monthlySummary, cashFlowByMonth }
}

describe('dashboard optimized queries', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupTestDb()
  })

  it('returns zeros when no transactions exist', () => {
    const { monthlySummary, cashFlowByMonth } = runDashboardQueries(db)

    expect(monthlySummary.monthly_spending).toBe(0)
    expect(monthlySummary.last_month_spending).toBe(0)
    expect(monthlySummary.monthly_income).toBe(0)
    expect(cashFlowByMonth).toHaveLength(6)
    for (const month of cashFlowByMonth) {
      expect(month.income).toBe(0)
      expect(month.expenses).toBe(0)
    }
  })

  it('correctly calculates this month spending and income', () => {
    const now = new Date()
    const thisMonth = format(now, 'yyyy-MM-dd')

    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description, category_id) VALUES (?, 'acc-1', ?, ?, 'Grocery Store', 'cat-food')`).run('t1', thisMonth, -50.25)
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description, category_id) VALUES (?, 'acc-1', ?, ?, 'Restaurant', 'cat-food')`).run('t2', thisMonth, -30.00)
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description, category_id) VALUES (?, 'acc-1', ?, ?, 'Paycheck', 'cat-income')`).run('t3', thisMonth, 3000.00)

    const { monthlySummary } = runDashboardQueries(db)

    expect(monthlySummary.monthly_spending).toBeCloseTo(80.25, 2)
    expect(monthlySummary.monthly_income).toBeCloseTo(3000.00, 2)
  })

  it('correctly calculates last month spending separately', () => {
    const now = new Date()
    const thisMonth = format(now, 'yyyy-MM-dd')
    const lastMonth = format(subMonths(now, 1), 'yyyy-MM-dd')

    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'This month expense')`).run('t1', thisMonth, -100)
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'Last month expense')`).run('t2', lastMonth, -200)

    const { monthlySummary } = runDashboardQueries(db)

    expect(monthlySummary.monthly_spending).toBeCloseTo(100, 2)
    expect(monthlySummary.last_month_spending).toBeCloseTo(200, 2)
  })

  it('groups cash flow by month correctly', () => {
    const now = new Date()
    const thisMonthLabel = format(now, 'yyyy-MM')
    const lastMonthLabel = format(subMonths(now, 1), 'yyyy-MM')
    const thisMonth = format(now, 'yyyy-MM-dd')
    const lastMonth = format(subMonths(now, 1), 'yyyy-MM-dd')

    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'Income')`).run('t1', thisMonth, 5000)
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'Expense')`).run('t2', thisMonth, -1500)
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'Old income')`).run('t3', lastMonth, 4000)
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'Old expense')`).run('t4', lastMonth, -800)

    const { cashFlowByMonth } = runDashboardQueries(db)

    const thisMonthRow = cashFlowByMonth.find(r => r.month === thisMonthLabel)!
    expect(thisMonthRow.income).toBeCloseTo(5000, 2)
    expect(thisMonthRow.expenses).toBeCloseTo(1500, 2)

    const lastMonthRow = cashFlowByMonth.find(r => r.month === lastMonthLabel)!
    expect(lastMonthRow.income).toBeCloseTo(4000, 2)
    expect(lastMonthRow.expenses).toBeCloseTo(800, 2)
  })

  it('fills zero for months with no transactions in cash flow', () => {
    const now = new Date()
    const thisMonth = format(now, 'yyyy-MM-dd')

    // Only add a transaction for this month
    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'Income')`).run('t1', thisMonth, 1000)

    const { cashFlowByMonth } = runDashboardQueries(db)

    expect(cashFlowByMonth).toHaveLength(6)
    // Months without transactions should have zero income and expenses
    const emptyMonths = cashFlowByMonth.filter(r => r.income === 0 && r.expenses === 0)
    expect(emptyMonths.length).toBe(5)
  })

  it('ignores transactions outside the 6-month window', () => {
    const now = new Date()
    const oldDate = format(subMonths(now, 7), 'yyyy-MM-dd')

    db.prepare(`INSERT INTO transactions (id, account_id, date, amount, raw_description) VALUES (?, 'acc-1', ?, ?, 'Old transaction')`).run('t1', oldDate, -500)

    const { monthlySummary, cashFlowByMonth } = runDashboardQueries(db)

    expect(monthlySummary.monthly_spending).toBe(0)
    for (const month of cashFlowByMonth) {
      expect(month.expenses).toBe(0)
    }
  })
})
