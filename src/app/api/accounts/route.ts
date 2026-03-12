import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createAccountSchema, updateAccountSchema, deleteAccountSchema, validateBody } from '@/lib/validation'

export async function GET() {
  try {
    const db = getDb()
    const accounts = db.prepare(
      `SELECT a.*,
        COALESCE(SUM(t.amount), 0) as balance,
        COUNT(t.id) as transaction_count
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    ).all()
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validation = validateBody(createAccountSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { name, type, institution, currency } = validation.data

    const id = crypto.randomUUID()
    db.prepare(
      'INSERT INTO accounts (id, name, type, institution, currency) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, type, institution, currency)

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validation = validateBody(updateAccountSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { id, name, type, institution, currency } = validation.data

    db.prepare(
      `UPDATE accounts SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        institution = COALESCE(?, institution),
        currency = COALESCE(?, currency)
       WHERE id = ?`
    ).run(name || null, type || null, institution ?? null, currency || null, id)

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
    return NextResponse.json({ account })
  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validation = validateBody(deleteAccountSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { id } = validation.data

    const txnCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?').get(id) as { count: number }
    if (txnCount.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete account with ${txnCount.count} transaction${txnCount.count > 1 ? 's' : ''}. Delete or move transactions first.` },
        { status: 400 }
      )
    }

    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
