import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validateBody, createReconciliationSchema } from '@/lib/validation'

export async function GET() {
  try {
    const db = getDb()
    const sessions = db.prepare(
      `SELECT rs.*, a.name as account_name
       FROM reconciliation_sessions rs
       JOIN accounts a ON rs.account_id = a.id
       ORDER BY rs.created_at DESC`
    ).all()
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching reconciliation sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch reconciliation sessions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const parsed = validateBody(createReconciliationSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { account_id, statement_date, statement_balance } = parsed.data

    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO reconciliation_sessions (id, account_id, statement_date, statement_balance)
       VALUES (?, ?, ?, ?)`
    ).run(id, account_id, statement_date, statement_balance)

    const session = db.prepare(
      `SELECT rs.*, a.name as account_name
       FROM reconciliation_sessions rs
       JOIN accounts a ON rs.account_id = a.id
       WHERE rs.id = ?`
    ).get(id)

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Error creating reconciliation session:', error)
    return NextResponse.json({ error: 'Failed to create reconciliation session' }, { status: 500 })
  }
}
