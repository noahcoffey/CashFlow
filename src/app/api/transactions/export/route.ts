import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { toCSV } from '@/lib/csv-export'

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const transactions = db.prepare(
      `SELECT t.date, t.raw_description, t.display_name, t.amount, t.notes,
              c.name as category_name, a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       ${whereClause}
       ORDER BY t.date DESC, t.created_at DESC`
    ).all(...params) as Array<{
      date: string
      raw_description: string
      display_name: string
      amount: number
      notes: string
      category_name: string | null
      account_name: string | null
    }>

    const headers = ['Date', 'Description', 'Display Name', 'Amount', 'Category', 'Account', 'Notes']
    const rows = transactions.map(t => [
      t.date,
      t.raw_description,
      t.display_name || '',
      t.amount.toFixed(2),
      t.category_name || '',
      t.account_name || '',
      t.notes || '',
    ])

    const csv = toCSV(headers, rows)

    const datePart = startDate && endDate ? `${startDate}_to_${endDate}` : new Date().toISOString().substring(0, 10)
    const filename = `transactions-${datePart}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting transactions:', error)
    return NextResponse.json({ error: 'Failed to export transactions' }, { status: 500 })
  }
}
