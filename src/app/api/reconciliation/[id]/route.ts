import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validateBody, completeReconciliationSchema } from '@/lib/validation'

interface ReconciliationSession {
  id: string
  account_id: string
  statement_date: string
  statement_balance: number
  status: string
  created_at: string
  account_name: string
}

interface TransactionRow {
  id: string
  amount: number
  date: string
  raw_description: string
  display_name: string
  category_name: string | null
  category_color: string | null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()

    const session = db.prepare(
      `SELECT rs.*, a.name as account_name
       FROM reconciliation_sessions rs
       JOIN accounts a ON rs.account_id = a.id
       WHERE rs.id = ?`
    ).get(id) as ReconciliationSession | undefined

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const transactions = db.prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.account_id = ? AND t.date <= ?
       ORDER BY t.date DESC`
    ).all(session.account_id, session.statement_date) as TransactionRow[]

    const calculatedBalance = transactions.reduce(
      (sum, t) => sum + t.amount, 0
    )

    return NextResponse.json({
      session,
      transactions,
      calculatedBalance,
      difference: session.statement_balance - calculatedBalance,
    })
  } catch (error) {
    console.error('Error fetching reconciliation session:', error)
    return NextResponse.json({ error: 'Failed to fetch reconciliation session' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()

    const session = db.prepare('SELECT * FROM reconciliation_sessions WHERE id = ?').get(id) as ReconciliationSession | undefined
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = validateBody(completeReconciliationSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { status, clearedIds } = parsed.data

    db.prepare(
      "UPDATE reconciliation_sessions SET status = ? WHERE id = ?"
    ).run(status, id)

    if (clearedIds && clearedIds.length > 0) {
      const placeholders = clearedIds.map(() => '?').join(',')
      db.prepare(
        `UPDATE transactions SET is_reconciled = 1
         WHERE id IN (${placeholders})`
      ).run(...clearedIds)
    }

    const updated = db.prepare(
      `SELECT rs.*, a.name as account_name
       FROM reconciliation_sessions rs
       JOIN accounts a ON rs.account_id = a.id
       WHERE rs.id = ?`
    ).get(id)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error completing reconciliation:', error)
    return NextResponse.json({ error: 'Failed to complete reconciliation' }, { status: 500 })
  }
}
