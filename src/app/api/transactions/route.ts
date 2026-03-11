import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createTransactionSchema, updateTransactionSchema, deleteTransactionSchema, validateBody } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')
    const accountId = searchParams.get('accountId')
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const isReconciled = searchParams.get('isReconciled')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const params: any[] = []

    if (search) {
      conditions.push('(t.raw_description LIKE ? OR t.display_name LIKE ? OR t.notes LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like)
    }
    if (accountId) {
      conditions.push('t.account_id = ?')
      params.push(accountId)
    }
    if (categoryId) {
      conditions.push('t.category_id = ?')
      params.push(categoryId)
    }
    if (startDate) {
      conditions.push('t.date >= ?')
      params.push(startDate)
    }
    if (endDate) {
      conditions.push('t.date <= ?')
      params.push(endDate)
    }
    if (isReconciled !== null && isReconciled !== undefined && isReconciled !== '') {
      conditions.push('t.is_reconciled = ?')
      params.push(isReconciled === 'true' ? 1 : 0)
    }
    if (minAmount) {
      conditions.push('t.amount >= ?')
      params.push(parseFloat(minAmount))
    }
    if (maxAmount) {
      conditions.push('t.amount <= ?')
      params.push(parseFloat(maxAmount))
    }

    const tagId = searchParams.get('tagId')
    if (tagId) {
      conditions.push('t.id IN (SELECT transaction_id FROM transaction_tags WHERE tag_id = ?)')
      params.push(tagId)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = db.prepare(
      `SELECT COUNT(*) as total FROM transactions t ${whereClause}`
    ).get(...params) as { total: number }

    const transactions = db.prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
              a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       ${whereClause}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    // Attach tags to each transaction
    const txnIds = (transactions as any[]).map(t => t.id)
    if (txnIds.length > 0) {
      const placeholders = txnIds.map(() => '?').join(',')
      const tagRows = db.prepare(
        `SELECT tt.transaction_id, tg.id, tg.name, tg.color
         FROM transaction_tags tt
         JOIN tags tg ON tt.tag_id = tg.id
         WHERE tt.transaction_id IN (${placeholders})`
      ).all(...txnIds) as Array<{ transaction_id: string; id: string; name: string; color: string }>

      const tagMap = new Map<string, Array<{ id: string; name: string; color: string }>>()
      for (const row of tagRows) {
        const list = tagMap.get(row.transaction_id) || []
        list.push({ id: row.id, name: row.name, color: row.color })
        tagMap.set(row.transaction_id, list)
      }
      for (const txn of transactions as any[]) {
        txn.tags = tagMap.get(txn.id) || []
      }
    }

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
