import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  try {
    const db = getDb()
    const now = new Date()
    const periods = [1, 2, 3, 6, 12]

    // For each period, get average monthly spend per category
    const result: Record<string, {
      category_id: string
      category_name: string
      category_icon: string
      category_color: string
      averages: Record<number, number>
      months: Record<number, number[]>
    }> = {}

    for (const months of periods) {
      const start = format(startOfMonth(subMonths(now, months)), 'yyyy-MM-dd')
      const end = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')

      const rows = db.prepare(
        `SELECT c.id as category_id, c.name as category_name, c.icon as category_icon, c.color as category_color,
                substr(t.date, 1, 7) as month,
                SUM(ABS(t.amount)) as total
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.amount < 0
           AND t.date >= ? AND t.date <= ?
         GROUP BY c.id, substr(t.date, 1, 7)
         ORDER BY c.name, month`
      ).all(start, end) as Array<{
        category_id: string
        category_name: string
        category_icon: string
        category_color: string
        month: string
        total: number
      }>

      for (const row of rows) {
        if (!result[row.category_id]) {
          result[row.category_id] = {
            category_id: row.category_id,
            category_name: row.category_name,
            category_icon: row.category_icon,
            category_color: row.category_color,
            averages: {},
            months: {},
          }
        }
        if (!result[row.category_id].months[months]) {
          result[row.category_id].months[months] = []
        }
        result[row.category_id].months[months].push(row.total)
      }
    }

    // Calculate averages
    for (const cat of Object.values(result)) {
      for (const months of periods) {
        const totals = cat.months[months] || []
        const sum = totals.reduce((a, b) => a + b, 0)
        cat.averages[months] = months > 0 ? sum / months : 0
      }
    }

    // Convert to sorted array, drop raw months data
    const categories = Object.values(result)
      .map(({ months, ...rest }) => rest)
      .sort((a, b) => {
        const aMax = Math.max(...Object.values(a.averages))
        const bMax = Math.max(...Object.values(b.averages))
        return bMax - aMax
      })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching budget history:', error)
    return NextResponse.json({ error: 'Failed to fetch budget history' }, { status: 500 })
  }
}
