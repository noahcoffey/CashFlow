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
    const sixMonthsAgoStart = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')

    // Combined monthly summary: this month spending, last month spending, this month income
    // Replaces 3 separate queries with 1 using conditional aggregation
    const monthlySummary = db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND amount < 0 THEN ABS(amount) END), 0) as monthly_spending,
         COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND amount < 0 THEN ABS(amount) END), 0) as last_month_spending,
         COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND amount > 0 THEN amount END), 0) as monthly_income
       FROM transactions
       WHERE date >= ? AND date <= ?`
    ).get(
      thisMonthStart, thisMonthEnd,
      lastMonthStart, lastMonthEnd,
      thisMonthStart, thisMonthEnd,
      lastMonthStart, thisMonthEnd
    ) as { monthly_spending: number; last_month_spending: number; monthly_income: number }

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

    // Cash flow by month (last 6 months) — single query replaces 12 separate queries
    const cashFlowRows = db.prepare(
      `SELECT strftime('%Y-%m', date) as month,
              COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) as income,
              COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END), 0) as expenses
       FROM transactions
       WHERE date >= ? AND date <= ?
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month`
    ).all(sixMonthsAgoStart, thisMonthEnd) as Array<{ month: string; income: number; expenses: number }>

    // Build the full 6-month array, filling in zeros for months with no transactions
    const cashFlowMap = new Map(cashFlowRows.map(r => [r.month, r]))
    const cashFlowByMonth = []
    for (let i = 5; i >= 0; i--) {
      const label = format(subMonths(now, i), 'yyyy-MM')
      const row = cashFlowMap.get(label)
      cashFlowByMonth.push({
        month: label,
        income: row?.income ?? 0,
        expenses: row?.expenses ?? 0,
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
      monthlySpending: monthlySummary.monthly_spending,
      lastMonthSpending: monthlySummary.last_month_spending,
      monthlyIncome: monthlySummary.monthly_income,
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
