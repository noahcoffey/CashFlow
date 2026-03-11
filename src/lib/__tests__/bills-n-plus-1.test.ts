import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema } from '../db'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { matchBillPayments, transactionMatchesBill } from '../bill-matcher'
import type { BillRecord, TransactionRecord } from '../bill-matcher'

/**
 * Tests the shared bill-matching helper used by GET /api/bills.
 * The route fetches all monthly transactions in a single query, then
 * calls matchBillPayments() — the same function tested here.
 */

let db: InstanceType<typeof Database>

function setupDb() {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)

  db.prepare(
    `INSERT INTO accounts (id, name, type) VALUES ('acc-1', 'Checking', 'checking')`
  ).run()
}

const now = new Date()
const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
const today = format(now, 'yyyy-MM-dd')

function makeBill(overrides: Partial<BillRecord> = {}): BillRecord {
  return {
    id: overrides.id ?? 'bill-1',
    name: overrides.name ?? 'Netflix',
    amount: overrides.amount ?? -15.99,
    next_due_date: overrides.next_due_date ?? today,
  }
}

function makeTxn(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: overrides.id ?? 'txn-1',
    amount: overrides.amount ?? -15.99,
    display_name: overrides.display_name ?? 'Netflix',
    raw_description: overrides.raw_description ?? 'NETFLIX.COM',
  }
}

describe('transactionMatchesBill', () => {
  it('matches when name and amount align', () => {
    expect(transactionMatchesBill(makeTxn(), makeBill())).toBe(true)
  })

  it('matches on raw_description when display_name differs', () => {
    const txn = makeTxn({ display_name: 'Some Payment', raw_description: 'NETFLIX SUBSCRIPTION' })
    expect(transactionMatchesBill(txn, makeBill())).toBe(true)
  })

  it('matches within $1 amount tolerance', () => {
    const txn = makeTxn({ amount: -16.50 })
    expect(transactionMatchesBill(txn, makeBill({ amount: -15.99 }))).toBe(true)
  })

  it('does not match when amount differs by more than $1', () => {
    const txn = makeTxn({ amount: -20.00 })
    expect(transactionMatchesBill(txn, makeBill({ amount: -15.99 }))).toBe(false)
  })

  it('is case-insensitive', () => {
    const txn = makeTxn({ display_name: 'NETFLIX MONTHLY' })
    expect(transactionMatchesBill(txn, makeBill({ name: 'netflix' }))).toBe(true)
  })

  it('does not match when name is absent from transaction', () => {
    const txn = makeTxn({ display_name: 'Spotify', raw_description: 'SPOTIFY PREMIUM' })
    expect(transactionMatchesBill(txn, makeBill({ name: 'Netflix' }))).toBe(false)
  })
})

describe('matchBillPayments', () => {
  it('marks a bill as paid when a matching transaction exists', () => {
    const results = matchBillPayments([makeBill()], [makeTxn()], monthStart, monthEnd, today)
    expect(results).toHaveLength(1)
    expect(results[0].isPaid).toBe(true)
  })

  it('marks a bill as unpaid when no matching transaction exists', () => {
    const results = matchBillPayments([makeBill()], [], monthStart, monthEnd, today)
    expect(results[0].isPaid).toBe(false)
  })

  it('handles multiple bills with different payment statuses', () => {
    const bills = [
      makeBill({ id: 'b1', name: 'Netflix', amount: -15.99 }),
      makeBill({ id: 'b2', name: 'Spotify', amount: -9.99 }),
      makeBill({ id: 'b3', name: 'Gym', amount: -50.00 }),
    ]
    const txns = [
      makeTxn({ id: 't1', display_name: 'Netflix', amount: -15.99 }),
      makeTxn({ id: 't2', display_name: 'Spotify Premium', amount: -9.99 }),
    ]
    const results = matchBillPayments(bills, txns, monthStart, monthEnd, today)

    expect(results.find(b => b.name === 'Netflix')!.isPaid).toBe(true)
    expect(results.find(b => b.name === 'Spotify')!.isPaid).toBe(true)
    expect(results.find(b => b.name === 'Gym')!.isPaid).toBe(false)
  })

  it('sets isDue when next_due_date is within the month', () => {
    const results = matchBillPayments(
      [makeBill({ next_due_date: monthStart })],
      [], monthStart, monthEnd, today
    )
    expect(results[0].isDue).toBe(true)
  })

  it('sets isOverdue when next_due_date is before today', () => {
    const results = matchBillPayments(
      [makeBill({ next_due_date: '2020-01-01' })],
      [], monthStart, monthEnd, today
    )
    expect(results[0].isOverdue).toBe(true)
    expect(results[0].isDue).toBe(false)
  })
})

describe('bills route uses shared helper (not reimplemented logic)', () => {
  beforeEach(() => setupDb())
  afterEach(() => db.close())

  it('fetches all monthly transactions in one query then uses matchBillPayments', () => {
    // Insert 10 bills
    for (let i = 0; i < 10; i++) {
      db.prepare(
        `INSERT INTO scheduled_bills (id, name, amount, frequency, next_due_date, account_id, is_active)
         VALUES (?, ?, ?, 'monthly', ?, 'acc-1', 1)`
      ).run(`b${i}`, `Service${i}`, -(10 + i), today)
    }

    // Insert one matching transaction
    db.prepare(
      `INSERT INTO transactions (id, account_id, date, amount, raw_description, display_name)
       VALUES ('t0', 'acc-1', ?, -10, 'SERVICE0', 'Service0')`
    ).run(today)

    // Reproduce the route's query pattern: single query + shared matchBillPayments
    const monthlyTxns = db.prepare(
      `SELECT id, amount, display_name, raw_description FROM transactions
       WHERE date >= ? AND date <= ?`
    ).all(monthStart, monthEnd) as TransactionRecord[]

    const bills = db.prepare(
      `SELECT id, name, amount, next_due_date FROM scheduled_bills WHERE is_active = 1`
    ).all() as BillRecord[]

    const results = matchBillPayments(bills, monthlyTxns, monthStart, monthEnd, today)

    expect(results).toHaveLength(10)
    expect(results.filter(b => b.isPaid)).toHaveLength(1)
    expect(results.filter(b => !b.isPaid)).toHaveLength(9)
  })

  it('route source imports and uses matchBillPayments from shared helper', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/bills/route.ts'),
      'utf-8'
    )
    expect(source).toContain("import { matchBillPayments } from '@/lib/bill-matcher'")
    expect(source).toContain('matchBillPayments(bills, monthlyTransactions,')
  })
})
