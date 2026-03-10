import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!type) {
      return NextResponse.json({ error: 'Report type is required' }, { status: 400 })
    }

    switch (type) {
      case 'spending-by-category': {
        const start = startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd')
        const end = endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')

        const data = db.prepare(
          `SELECT c.id, c.name, c.color, c.icon,
                  SUM(ABS(t.amount)) as total,
                  COUNT(t.id) as transaction_count
           FROM transactions t
           JOIN categories c ON t.category_id = c.id
           WHERE t.date >= ? AND t.date <= ? AND t.amount < 0
           GROUP BY c.id
           ORDER BY total DESC`
        ).all(start, end)

        return NextResponse.json({ data, startDate: start, endDate: end })
      }

      case 'monthly-trends': {
        const months = []
        const now = new Date()
        for (let i = 11; i >= 0; i--) {
          const month = subMonths(now, i)
          months.push({
            start: format(startOfMonth(month), 'yyyy-MM-dd'),
            end: format(endOfMonth(month), 'yyyy-MM-dd'),
            label: format(month, 'yyyy-MM'),
          })
        }

        const data = months.map(m => {
          const categories = db.prepare(
            `SELECT c.id, c.name, c.color,
                    SUM(ABS(t.amount)) as total
             FROM transactions t
             JOIN categories c ON t.category_id = c.id
             WHERE t.date >= ? AND t.date <= ? AND t.amount < 0
             GROUP BY c.id
             ORDER BY total DESC`
          ).all(m.start, m.end)

          return { month: m.label, categories }
        })

        return NextResponse.json({ data })
      }

      case 'income-vs-expenses': {
        const months = []
        const now = new Date()
        for (let i = 11; i >= 0; i--) {
          const month = subMonths(now, i)
          months.push({
            start: format(startOfMonth(month), 'yyyy-MM-dd'),
            end: format(endOfMonth(month), 'yyyy-MM-dd'),
            label: format(month, 'yyyy-MM'),
          })
        }

        const data = months.map(m => {
          const income = db.prepare(
            `SELECT COALESCE(SUM(t.amount), 0) as total
             FROM transactions t
             WHERE t.date >= ? AND t.date <= ? AND t.amount > 0`
          ).get(m.start, m.end) as { total: number }

          const expenses = db.prepare(
            `SELECT COALESCE(SUM(ABS(t.amount)), 0) as total
             FROM transactions t
             WHERE t.date >= ? AND t.date <= ? AND t.amount < 0`
          ).get(m.start, m.end) as { total: number }

          return {
            month: m.label,
            income: income.total,
            expenses: expenses.total,
            net: income.total - expenses.total,
          }
        })

        return NextResponse.json({ data })
      }

      case 'net-worth': {
        const months = []
        const now = new Date()
        for (let i = 11; i >= 0; i--) {
          const month = subMonths(now, i)
          months.push({
            end: format(endOfMonth(month), 'yyyy-MM-dd'),
            label: format(month, 'yyyy-MM'),
          })
        }

        const accounts = db.prepare('SELECT id, name, type FROM accounts').all() as any[]

        const data = months.map(m => {
          const balances: Record<string, any> = {}
          let total = 0

          for (const account of accounts) {
            const result = db.prepare(
              `SELECT COALESCE(SUM(amount), 0) as balance
               FROM transactions
               WHERE account_id = ? AND date <= ?`
            ).get(account.id, m.end) as { balance: number }

            balances[account.name] = result.balance
            total += result.balance
          }

          return { month: m.label, balances, total }
        })

        return NextResponse.json({ data, accounts: accounts.map(a => a.name) })
      }

      case 'year-over-year': {
        // Get all years with data
        const yearsResult = db.prepare(
          `SELECT DISTINCT substr(date, 1, 4) as year FROM transactions ORDER BY year`
        ).all() as { year: string }[]
        const years = yearsResult.map(y => y.year)

        if (years.length === 0) {
          return NextResponse.json({ data: [], years: [] })
        }

        // For each month (1-12), get spending per year
        const data = []
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for (let m = 1; m <= 12; m++) {
          const monthStr = m.toString().padStart(2, '0')
          const row: Record<string, any> = { month: monthNames[m - 1] }

          for (const year of years) {
            const result = db.prepare(
              `SELECT COALESCE(SUM(ABS(amount)), 0) as total
               FROM transactions
               WHERE date >= ? AND date <= ? AND amount < 0`
            ).get(`${year}-${monthStr}-01`, `${year}-${monthStr}-31`) as { total: number }

            row[year] = result.total
          }
          data.push(row)
        }

        // Category breakdown per year
        const categoryByYear = years.map(year => {
          const cats = db.prepare(
            `SELECT c.name, c.color, c.icon, SUM(ABS(t.amount)) as total
             FROM transactions t
             JOIN categories c ON t.category_id = c.id
             WHERE substr(t.date, 1, 4) = ? AND t.amount < 0
             GROUP BY c.id
             ORDER BY total DESC
             LIMIT 10`
          ).all(year) as { name: string; color: string; icon: string; total: number }[]
          return { year, categories: cats }
        })

        // Year totals
        const yearTotals = years.map(year => {
          const result = db.prepare(
            `SELECT COALESCE(SUM(ABS(amount)), 0) as expenses,
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income
             FROM transactions WHERE substr(date, 1, 4) = ?`
          ).get(year) as { expenses: number; income: number }
          return { year, ...result }
        })

        return NextResponse.json({ data, years, categoryByYear, yearTotals })
      }

      default:
        return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
