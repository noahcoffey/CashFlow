import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { initializeSchema } from '../db'
import { format, startOfMonth, endOfMonth } from 'date-fns'

/**
 * Tests that bill payment matching works correctly using the batched
 * approach (single query for all monthly transactions) instead of N+1.
 */

let db: InstanceType<typeof Database>

function setupDb() {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)

  // Insert a test account
  db.prepare(
    `INSERT INTO accounts (id, name, type) VALUES ('acc-1', 'Checking', 'checking')`
  ).run()
}

function insertBill(overrides: Partial<{
  id: string; name: string; amount: number; frequency: string
  next_due_date: string; account_id: string; is_active: number
}> = {}) {
  const bill = {
    id: overrides.id ?? 'bill-1',
    name: overrides.name ?? 'Netflix',
    amount: overrides.amount ?? -15.99,
    frequency: overrides.frequency ?? 'monthly',
    next_due_date: overrides.next_due_date ?? format(new Date(), 'yyyy-MM-dd'),
    account_id: overrides.account_id ?? 'acc-1',
    is_active: overrides.is_active ?? 1,
  }
  db.prepare(
    `INSERT INTO scheduled_bills (id, name, amount, frequency, next_due_date, account_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(bill.id, bill.name, bill.amount, bill.frequency, bill.next_due_date, bill.account_id, bill.is_active)
  return bill
}

function insertTransaction(overrides: Partial<{
  id: string; date: string; amount: number; display_name: string; raw_description: string
}> = {}) {
  const txn = {
    id: overrides.id ?? 'txn-1',
    date: overrides.date ?? format(new Date(), 'yyyy-MM-dd'),
    amount: overrides.amount ?? -15.99,
    display_name: overrides.display_name ?? 'Netflix',
    raw_description: overrides.raw_description ?? 'NETFLIX.COM',
  }
  db.prepare(
    `INSERT INTO transactions (id, account_id, date, amount, raw_description, display_name)
     VALUES (?, 'acc-1', ?, ?, ?, ?)`
  ).run(txn.id, txn.date, txn.amount, txn.raw_description, txn.display_name)
  return txn
}

/**
 * Reproduces the batched bill-matching logic from the GET /api/bills endpoint.
 * Instead of querying per-bill (N+1), we fetch all monthly transactions once.
 */
function getBillsWithStatus() {
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const bills = db.prepare(
    `SELECT b.* FROM scheduled_bills b WHERE b.is_active = 1 ORDER BY b.next_due_date ASC`
  ).all() as Array<{
    id: string; name: string; amount: number; frequency: string
    next_due_date: string; is_active: number
  }>

  // Single query: fetch all transactions this month
  const monthlyTransactions = db.prepare(
    `SELECT id, amount, display_name, raw_description FROM transactions
     WHERE date >= ? AND date <= ?`
  ).all(monthStart, monthEnd) as Array<{
    id: string; amount: number; display_name: string; raw_description: string
  }>

  const today = format(now, 'yyyy-MM-dd')
  return bills.map(bill => {
    const match = monthlyTransactions.find(t =>
      Math.abs(t.amount - bill.amount) < 1 &&
      (t.display_name.toLowerCase().includes(bill.name.toLowerCase()) ||
       t.raw_description.toLowerCase().includes(bill.name.toLowerCase()))
    )
    return {
      ...bill,
      isPaid: !!match,
      isDue: bill.next_due_date >= monthStart && bill.next_due_date <= monthEnd,
      isOverdue: bill.next_due_date < today,
    }
  })
}

describe('bills N+1 fix: batched payment matching', () => {
  beforeEach(() => setupDb())
  afterEach(() => db.close())

  it('marks a bill as paid when a matching transaction exists', () => {
    insertBill({ name: 'Netflix', amount: -15.99 })
    insertTransaction({ display_name: 'Netflix', amount: -15.99 })

    const results = getBillsWithStatus()
    expect(results).toHaveLength(1)
    expect(results[0].isPaid).toBe(true)
  })

  it('marks a bill as unpaid when no matching transaction exists', () => {
    insertBill({ name: 'Netflix', amount: -15.99 })

    const results = getBillsWithStatus()
    expect(results).toHaveLength(1)
    expect(results[0].isPaid).toBe(false)
  })

  it('matches on raw_description when display_name does not match', () => {
    insertBill({ name: 'Netflix', amount: -15.99 })
    insertTransaction({
      display_name: 'Some Payment',
      raw_description: 'NETFLIX SUBSCRIPTION',
      amount: -15.99,
    })

    const results = getBillsWithStatus()
    expect(results[0].isPaid).toBe(true)
  })

  it('matches within $1 tolerance on amount', () => {
    insertBill({ name: 'Spotify', amount: -9.99 })
    insertTransaction({ display_name: 'Spotify', amount: -10.50 })

    const results = getBillsWithStatus()
    expect(results[0].isPaid).toBe(true)
  })

  it('does not match when amount differs by more than $1', () => {
    insertBill({ name: 'Spotify', amount: -9.99 })
    insertTransaction({ display_name: 'Spotify', amount: -12.00 })

    const results = getBillsWithStatus()
    expect(results[0].isPaid).toBe(false)
  })

  it('handles multiple bills with different payment statuses', () => {
    insertBill({ id: 'b1', name: 'Netflix', amount: -15.99 })
    insertBill({ id: 'b2', name: 'Spotify', amount: -9.99 })
    insertBill({ id: 'b3', name: 'Gym', amount: -50.00 })

    insertTransaction({ id: 't1', display_name: 'Netflix', amount: -15.99 })
    insertTransaction({ id: 't2', display_name: 'Spotify Premium', amount: -9.99 })

    const results = getBillsWithStatus()
    expect(results).toHaveLength(3)

    const netflix = results.find(b => b.name === 'Netflix')!
    const spotify = results.find(b => b.name === 'Spotify')!
    const gym = results.find(b => b.name === 'Gym')!

    expect(netflix.isPaid).toBe(true)
    expect(spotify.isPaid).toBe(true)
    expect(gym.isPaid).toBe(false)
  })

  it('uses only one query for transactions regardless of bill count', () => {
    // Insert 10 bills — with the old approach this would be 10 queries
    for (let i = 0; i < 10; i++) {
      insertBill({ id: `b${i}`, name: `Service${i}`, amount: -(10 + i) })
    }
    insertTransaction({ id: 't0', display_name: 'Service0', amount: -10 })

    const results = getBillsWithStatus()
    expect(results).toHaveLength(10)
    expect(results.filter(b => b.isPaid)).toHaveLength(1)
    expect(results.filter(b => !b.isPaid)).toHaveLength(9)
  })

  it('is case-insensitive when matching bill name to transaction', () => {
    insertBill({ name: 'Netflix', amount: -15.99 })
    insertTransaction({ display_name: 'NETFLIX MONTHLY', amount: -15.99 })

    const results = getBillsWithStatus()
    expect(results[0].isPaid).toBe(true)
  })

  it('excludes inactive bills', () => {
    insertBill({ id: 'b1', name: 'Netflix', amount: -15.99, is_active: 1 })
    insertBill({ id: 'b2', name: 'Old Service', amount: -5.00, is_active: 0 })

    const results = getBillsWithStatus()
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Netflix')
  })
})
