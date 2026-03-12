import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createTransactionSchema, updateTransactionSchema, deleteTransactionSchema, validateBody } from '@/lib/validation'
import { buildTransactionFilters } from '@/lib/transaction-filters'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)

    const rawPage = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '50')

    if (isNaN(rawPage) || isNaN(rawLimit)) {
      return NextResponse.json({ error: 'page and limit must be valid numbers' }, { status: 400 })
    }

    const page = Math.max(1, rawPage)
    const limit = Math.min(Math.max(1, rawLimit), 500)
    const offset = (page - 1) * limit

    const { whereClause, params } = buildTransactionFilters(searchParams)

    const countResult = db.prepare(
      `SELECT COUNT(*) as total FROM transactions t ${whereClause}`
    ).get(...params) as { total: number }

    const rawTransactions = db.prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
              a.name as account_name,
              (SELECT json_group_array(json_object('id', tg.id, 'name', tg.name, 'color', tg.color))
               FROM transaction_tags tt
               JOIN tags tg ON tt.tag_id = tg.id
               WHERE tt.transaction_id = t.id) as tags_json
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       ${whereClause}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Array<Record<string, unknown> & { tags_json: string }>

    const transactions = rawTransactions.map(({ tags_json, ...rest }) => ({
      ...rest,
      tags: tags_json ? JSON.parse(tags_json).filter((t: { id: string | null }) => t.id !== null) : [],
    }))

    return NextResponse.json({
      transactions,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validation = validateBody(createTransactionSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { account_id, date, amount, raw_description, display_name, category_id, notes } = validation.data

    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO transactions (id, account_id, date, amount, raw_description, display_name, category_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, account_id, date, amount, raw_description, display_name, category_id || null, notes)

    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validation = validateBody(updateTransactionSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { id, account_id, date, amount, raw_description, display_name, category_id, is_reconciled, notes } = validation.data

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    db.prepare(
      `UPDATE transactions SET
        account_id = COALESCE(?, account_id),
        date = COALESCE(?, date),
        amount = COALESCE(?, amount),
        raw_description = COALESCE(?, raw_description),
        display_name = COALESCE(?, display_name),
        category_id = ?,
        is_reconciled = COALESCE(?, is_reconciled),
        notes = COALESCE(?, notes)
       WHERE id = ?`
    ).run(
      account_id || null,
      date || null,
      amount ?? null,
      raw_description || null,
      display_name ?? null,
      category_id !== undefined ? category_id : null,
      is_reconciled ?? null,
      notes ?? null,
      id
    )

    const updated = db.prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
              a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.id = ?`
    ).get(id)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validation = validateBody(deleteTransactionSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { id } = validation.data

    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
