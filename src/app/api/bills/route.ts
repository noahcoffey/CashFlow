import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { format, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, addYears } from 'date-fns'

export async function GET() {
  try {
    const db = getDb()
    const now = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

    const bills = db.prepare(
      `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
              a.name as account_name
       FROM scheduled_bills b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN accounts a ON b.account_id = a.id
       WHERE b.is_active = 1
       ORDER BY b.next_due_date ASC`
    ).all() as Array<{
      id: string; name: string; amount: number; frequency: string
      next_due_date: string; category_id: string | null; account_id: string | null
      is_active: number; category_name: string | null; category_icon: string | null
      category_color: string | null; account_name: string | null
    }>

    // Check which bills due this month have been paid
    const billsWithStatus = bills.map(bill => {
      // Look for a matching transaction this month
      const match = db.prepare(
        `SELECT id FROM transactions
         WHERE date >= ? AND date <= ?
         AND ABS(amount - ?) < 1
         AND (display_name LIKE ? OR raw_description LIKE ?)
         LIMIT 1`
      ).get(
        monthStart, monthEnd,
        bill.amount,
        `%${bill.name}%`, `%${bill.name}%`
      )

      return {
        ...bill,
        isPaid: !!match,
        isDue: bill.next_due_date >= monthStart && bill.next_due_date <= monthEnd,
        isOverdue: bill.next_due_date < format(now, 'yyyy-MM-dd'),
      }
    })

    const totalMonthly = bills.reduce((sum, b) => {
      const multiplier: Record<string, number> = {
        weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 0.33, annual: 0.083
      }
      return sum + Math.abs(b.amount) * (multiplier[b.frequency] || 1)
    }, 0)

    const paidThisMonth = billsWithStatus.filter(b => b.isPaid).length
    const dueThisMonth = billsWithStatus.filter(b => b.isDue || b.isOverdue).length

    return NextResponse.json({
      bills: billsWithStatus,
      totalMonthly,
      paidThisMonth,
      dueThisMonth,
    })
  } catch (error) {
    console.error('Error fetching bills:', error)
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { name, amount, frequency, next_due_date, category_id, account_id } = await request.json()

    if (!name || amount === undefined || !frequency || !next_due_date) {
      return NextResponse.json({ error: 'name, amount, frequency, and next_due_date are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO scheduled_bills (id, name, amount, frequency, next_due_date, category_id, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, amount, frequency, next_due_date, category_id || null, account_id || null)

    const bill = db.prepare('SELECT * FROM scheduled_bills WHERE id = ?').get(id)
    return NextResponse.json({ bill }, { status: 201 })
  } catch (error) {
    console.error('Error creating bill:', error)
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const { id, name, amount, frequency, next_due_date, category_id, account_id, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Bill id is required' }, { status: 400 })
    }

    db.prepare(
      `UPDATE scheduled_bills SET
        name = COALESCE(?, name),
        amount = COALESCE(?, amount),
        frequency = COALESCE(?, frequency),
        next_due_date = COALESCE(?, next_due_date),
        category_id = ?,
        account_id = ?,
        is_active = COALESCE(?, is_active)
       WHERE id = ?`
    ).run(name || null, amount ?? null, frequency || null, next_due_date || null,
          category_id !== undefined ? (category_id || null) : null,
          account_id !== undefined ? (account_id || null) : null,
          is_active ?? null, id)

    const bill = db.prepare('SELECT * FROM scheduled_bills WHERE id = ?').get(id)
    return NextResponse.json({ bill })
  } catch (error) {
    console.error('Error updating bill:', error)
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Bill id is required' }, { status: 400 })
    }

    db.prepare('DELETE FROM scheduled_bills WHERE id = ?').run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bill:', error)
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 })
  }
}
