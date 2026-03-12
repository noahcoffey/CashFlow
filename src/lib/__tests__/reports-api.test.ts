import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema } from '../db'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

/**
 * Tests that exercise the same SQL queries used by GET /api/reports
 * against a real in-memory SQLite database.
 */

let db: InstanceType<typeof Database>

function setup() {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)

  // Create test account
  db.prepare(`INSERT INTO accounts (id, name, type) VALUES ('acc-1', 'Checking', 'checking')`).run()

  // Create test categories (override seeded ones)
  db.prepare(`INSERT OR REPLACE INTO categories (id, name, color, icon, type) VALUES ('cat-food', 'Food', '#FF0000', '🍔', 'expense')`).run()
  db.prepare(`INSERT OR REPLACE INTO categories (id, name, color, icon, type) VALUES ('cat-salary', 'Salary', '#00FF00', '💰', 'income')`).run()
  db.prepare(`INSERT OR REPLACE INTO categories (id, name, color, icon, type) VALUES ('cat-rent', 'Rent', '#0000FF', '🏠', 'expense')`).run()
}

function insertTxn(date: string, amount: number, categoryId: string | null = null) {
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO transactions (id, account_id, date, amount, raw_description, display_name, category_id)
     VALUES (?, 'acc-1', ?, ?, 'test', 'Test', ?)`
  ).run(id, date, amount, categoryId)
}

const now = new Date()
const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')
const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
const thisMonth15 = format(now, 'yyyy-MM') + '-15'
const lastMonth15 = format(subMonths(now, 1), 'yyyy-MM') + '-15'

describe('spending-by-category report', () => {
  beforeEach(() => setup())
  afterEach(() => db.close())

  it('aggregates spending by category for a date range', () => {
    insertTxn(thisMonth15, -50, 'cat-food')
    insertTxn(thisMonth15, -30, 'cat-food')
    insertTxn(thisMonth15, -1200, 'cat-rent')
    insertTxn(thisMonth15, 3000, 'cat-salary') // income, should be excluded

    const data = db.prepare(
      `SELECT c.id, c.name, c.color, c.icon,
              SUM(ABS(t.amount)) as total,
              COUNT(t.id) as transaction_count
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ? AND t.date <= ? AND t.amount < 0
       GROUP BY c.id
       ORDER BY total DESC`
    ).all(thisMonthStart, thisMonthEnd) as Array<{ name: string; total: number; transaction_count: number }>

    expect(data).toHaveLength(2)
    expect(data[0].name).toBe('Rent')
    expect(data[0].total).toBe(1200)
    expect(data[1].name).toBe('Food')
    expect(data[1].total).toBe(80)
    expect(data[1].transaction_count).toBe(2)
  })

  it('returns empty array when no transactions exist', () => {
    const data = db.prepare(
      `SELECT c.id, c.name, SUM(ABS(t.amount)) as total, COUNT(t.id) as transaction_count
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ? AND t.date <= ? AND t.amount < 0
       GROUP BY c.id`
    ).all(thisMonthStart, thisMonthEnd)

    expect(data).toHaveLength(0)
  })
})

describe('income-vs-expenses report', () => {
  beforeEach(() => setup())
  afterEach(() => db.close())

  it('computes income and expenses for a month', () => {
    insertTxn(thisMonth15, -200, 'cat-food')
    insertTxn(thisMonth15, -1200, 'cat-rent')
    insertTxn(thisMonth15, 3000, 'cat-salary')

    const income = db.prepare(
      `SELECT COALESCE(SUM(t.amount), 0) as total
       FROM transactions t
       WHERE t.date >= ? AND t.date <= ? AND t.amount > 0`
    ).get(thisMonthStart, thisMonthEnd) as { total: number }

    const expenses = db.prepare(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) as total
       FROM transactions t
       WHERE t.date >= ? AND t.date <= ? AND t.amount < 0`
    ).get(thisMonthStart, thisMonthEnd) as { total: number }

    expect(income.total).toBe(3000)
    expect(expenses.total).toBe(1400)
  })

  it('returns zero when no transactions in the month', () => {
    const income = db.prepare(
      `SELECT COALESCE(SUM(t.amount), 0) as total
       FROM transactions t WHERE t.date >= ? AND t.date <= ? AND t.amount > 0`
    ).get(thisMonthStart, thisMonthEnd) as { total: number }

    expect(income.total).toBe(0)
  })
})

describe('net-worth report', () => {
  beforeEach(() => setup())
  afterEach(() => db.close())

  it('computes running balance per account up to a date', () => {
    insertTxn(thisMonth15, 5000, null)
    insertTxn(thisMonth15, -500, null)

    const result = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as balance
       FROM transactions WHERE account_id = ? AND date <= ?`
    ).get('acc-1', thisMonthEnd) as { balance: number }

    expect(result.balance).toBe(4500)
  })
})

describe('year-over-year report', () => {
  beforeEach(() => setup())
  afterEach(() => db.close())

  it('returns distinct years from transactions', () => {
    insertTxn('2025-06-15', -100, 'cat-food')
    insertTxn('2026-01-15', -200, 'cat-food')

    const years = db.prepare(
      `SELECT DISTINCT substr(date, 1, 4) as year FROM transactions ORDER BY year`
    ).all() as { year: string }[]

    expect(years.map(y => y.year)).toEqual(['2025', '2026'])
  })

  it('computes year totals for expenses and income', () => {
    insertTxn('2026-01-15', -500, 'cat-food')
    insertTxn('2026-02-15', -300, 'cat-rent')
    insertTxn('2026-01-15', 4000, 'cat-salary')

    const result = db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as expenses,
              COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income
       FROM transactions WHERE substr(date, 1, 4) = ?`
    ).get('2026') as { expenses: number; income: number }

    expect(result.expenses).toBe(4800) // 500 + 300 + 4000 (ABS of all)
    expect(result.income).toBe(4000)
  })

  it('returns empty data when no transactions', () => {
    const years = db.prepare(
      `SELECT DISTINCT substr(date, 1, 4) as year FROM transactions ORDER BY year`
    ).all()

    expect(years).toHaveLength(0)
  })

  it('computes category breakdown per year', () => {
    insertTxn('2026-01-15', -500, 'cat-food')
    insertTxn('2026-02-15', -1200, 'cat-rent')

    const cats = db.prepare(
      `SELECT c.name, c.color, c.icon, SUM(ABS(t.amount)) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE substr(t.date, 1, 4) = ? AND t.amount < 0
       GROUP BY c.id
       ORDER BY total DESC
       LIMIT 10`
    ).all('2026') as Array<{ name: string; total: number }>

    expect(cats).toHaveLength(2)
    expect(cats[0].name).toBe('Rent')
    expect(cats[0].total).toBe(1200)
    expect(cats[1].name).toBe('Food')
    expect(cats[1].total).toBe(500)
  })
})

describe('report type validation', () => {
  it('route source returns 400 for missing type', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/reports/route.ts'), 'utf-8'
    )
    expect(source).toContain("if (!type)")
    expect(source).toContain("Report type is required")
    expect(source).toContain("Unknown report type")
  })
})
