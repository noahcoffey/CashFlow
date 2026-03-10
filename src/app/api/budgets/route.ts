import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  try {
    const db = getDb()
    const now = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

    const budgets = db.prepare(
      `SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon, c.type as category_type,
              COALESCE(
                (SELECT SUM(ABS(t.amount))
                 FROM transactions t
                 WHERE t.category_id = b.category_id
                   AND t.date >= ? AND t.date <= ?
                   AND t.amount < 0),
                0
              ) as spent
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       ORDER BY c.name`
    ).all(monthStart, monthEnd)

    return NextResponse.json({ budgets })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { category_id, amount, period, start_date, end_date } = await request.json()

    if (!category_id || amount === undefined || !period) {
      return NextResponse.json({ error: 'category_id, amount, and period are required' }, { status: 400 })
    }

    // Check if budget already exists for this category
    const existing = db.prepare('SELECT id FROM budgets WHERE category_id = ?').get(category_id) as { id: string } | undefined

    if (existing) {
      db.prepare(
        'UPDATE budgets SET amount = ?, period = ?, start_date = ?, end_date = ? WHERE id = ?'
      ).run(amount, period, start_date || null, end_date || null, existing.id)

      const updated = db.prepare(
        `SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
         FROM budgets b
         JOIN categories c ON b.category_id = c.id
         WHERE b.id = ?`
      ).get(existing.id)

      return NextResponse.json(updated)
    }

    const id = crypto.randomUUID()
    db.prepare(
      'INSERT INTO budgets (id, category_id, amount, period, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, category_id, amount, period, start_date || null, end_date || null)

    const budget = db.prepare(
      `SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`
    ).get(id)

    return NextResponse.json(budget, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating budget:', error)
    return NextResponse.json({ error: 'Failed to create/update budget' }, { status: 500 })
  }
}
