import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function GET() {
  try {
    const db = getDb()
    const now = new Date()
    const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
    const lastMonth = subMonths(now, 1)
    const lastMonthStart = format(startOfMonth(lastMonth), 'yyyy-MM-dd')
    const lastMonthEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd')

    // Monthly spending (expenses this month)
    const monthlySpendingResult = db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total
       FROM transactions
       WHERE date >= ? AND date <= ? AND amount < 0`
    ).get(thisMonthStart, thisMonthEnd) as { total: number }

    // Last month spending
    const lastMonthSpendingResult = db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total
       FROM transactions
       WHERE date >= ? AND date <= ? AND amount < 0`
    ).get(lastMonthStart, lastMonthEnd) as { total: number }

    // Monthly income
    const monthlyIncomeResult = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE date >= ? AND date <= ? AND amount > 0`
    ).get(thisMonthStart, thisMonthEnd) as { total: number }

    // Top 5 spending categories this month
    const topCategories = db.prepare(
      `SELECT c.id, c.name, c.color, c.icon,
              SUM(ABS(t.amount)) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ? AND t.date <= ? AND t.amount < 0
       GROUP BY c.id
       ORDER BY total DESC
       LIMIT 5`
    ).all(thisMonthStart, thisMonthEnd)

    // Recent 10 transactions
    const recentTransactions = db.prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
              a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT 10`
    ).all()

    // Account balances
    const accountBalances = db.prepare(
      `SELECT a.id, a.name, a.type, a.institution, a.currency,
              COALESCE(SUM(t.amount), 0) as balance
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id
       GROUP BY a.id
       ORDER BY a.name`
    ).all()

    // Cash flow by month (last 6 months)
    const cashFlowByMonth = []
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(now, i)
      const mStart = format(startOfMonth(month), 'yyyy-MM-dd')
      const mEnd = format(endOfMonth(month), 'yyyy-MM-dd')
      const label = format(month, 'yyyy-MM')

      const income = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE date >= ? AND date <= ? AND amount > 0`
      ).get(mStart, mEnd) as { total: number }

      const expenses = db.prepare(
        `SELECT COALESCE(SUM(ABS(amount)), 0) as total
         FROM transactions
         WHERE date >= ? AND date <= ? AND amount < 0`
      ).get(mStart, mEnd) as { total: number }

      cashFlowByMonth.push({
        month: label,
        income: income.total,
        expenses: expenses.total,
      })
    }

    // Budget utilization
    const budgetUtilization = db.prepare(
      `SELECT b.id, b.amount as budgeted, b.period,
              c.id as category_id, c.name as category_name, c.color as category_color, c.icon as category_icon,
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
    ).all(thisMonthStart, thisMonthEnd)

    return NextResponse.json({
      monthlySpending: monthlySpendingResult.total,
      lastMonthSpending: lastMonthSpendingResult.total,
      monthlyIncome: monthlyIncomeResult.total,
      topCategories,
      recentTransactions,
      accountBalances,
      cashFlowByMonth,
      budgetUtilization,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
