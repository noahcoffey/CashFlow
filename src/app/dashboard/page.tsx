"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  Plus,
  CalendarClock,
  Check,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChartErrorBoundary } from "@/components/chart-error-boundary"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface DashboardData {
  monthlySpending: number
  lastMonthSpending: number
  monthlyIncome: number
  topCategories: { name: string; color: string; icon: string; total: number }[]
  recentTransactions: {
    id: string
    date: string
    display_name: string
    raw_description: string
    amount: number
    category_name: string
    category_color: string
    category_icon: string
    account_name: string
  }[]
  accountBalances: { name: string; type: string; balance: number }[]
  cashFlowByMonth: { month: string; income: number; expenses: number }[]
  budgetUtilization: { category_name: string; category_color: string; category_icon: string; spent: number; budgeted: number }[]
  uncategorizedCount: number
}

interface Bill {
  id: string; name: string; amount: number; frequency: string
  next_due_date: string; isPaid: boolean; isDue: boolean; isOverdue: boolean
  category_icon: string | null
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [billsLoading, setBillsLoading] = useState(true)

  useEffect(() => {
    setError(null)
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load dashboard (${r.status})`)
        return r.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setDashboardLoading(false))
    fetch("/api/bills")
      .then(r => r.json())
      .then(d => setBills(d.bills || []))
      .catch(() => {})
      .finally(() => setBillsLoading(false))
  }, [])

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-zinc-200">Failed to load dashboard</h2>
        <p className="text-sm text-zinc-500 mt-1 mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!dashboardLoading && (!data || (data.accountBalances.length === 0 && data.recentTransactions.length === 0))) {
    return <WelcomeScreen />
  }

  const spendingChange = data?.lastMonthSpending
    ? ((data.monthlySpending - data.lastMonthSpending) / data.lastMonthSpending) * 100
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-500 text-sm">Your financial overview</p>
        </div>
        <div className="flex gap-2 items-center">
          {data && data.uncategorizedCount > 0 && (
            <Link href="/transactions?category=uncategorized">
              <Badge variant="secondary" className="cursor-pointer hover:bg-zinc-700 text-amber-400 border border-amber-400/30">
                <AlertCircle className="h-3 w-3 mr-1" />
                {data.uncategorizedCount} uncategorized
              </Badge>
            </Link>
          )}
          <Link href="/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardLoading ? (
          [...Array(4)].map((_, i) => <SummaryCardSkeleton key={i} />)
        ) : data ? (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Monthly Spending</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(data.monthlySpending)}</p>
                    {spendingChange !== 0 && (
                      <div className={`flex items-center gap-1 mt-1 text-xs ${spendingChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {spendingChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(spendingChange).toFixed(1)}% vs last month
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-red-600/10">
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Monthly Income</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(data.monthlyIncome)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-600/10">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Net Cash Flow</p>
                    <p className={`text-2xl font-bold mt-1 ${data.monthlyIncome - data.monthlySpending >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(data.monthlyIncome - data.monthlySpending)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-600/10">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Total Balance</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(data.accountBalances.reduce((s, a) => s + a.balance, 0))}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {data.accountBalances.length} account{data.accountBalances.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-600/10">
                    <Wallet className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        {dashboardLoading ? (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Income vs Expenses</CardTitle></CardHeader>
            <CardContent><Skeleton className="h-[280px] rounded-lg" /></CardContent>
          </Card>
        ) : data ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {data.cashFlowByMonth.length > 0 ? (
                <ChartErrorBoundary>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.cashFlowByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
                      <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartErrorBoundary>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-zinc-500">
                  No data yet
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Top Categories */}
        {dashboardLoading ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Top Categories</CardTitle></CardHeader>
            <CardContent>
              <Skeleton className="h-[160px] rounded-lg" />
              <div className="space-y-2 mt-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : data ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topCategories.length > 0 ? (
                <div className="space-y-2">
                  <ChartErrorBoundary>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={data.topCategories.map(c => ({ name: c.name, value: Math.abs(c.total) }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                          stroke="none"
                        >
                          {data.topCategories.map((c, i) => (
                            <Cell key={i} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartErrorBoundary>
                  <div className="space-y-2 mt-2">
                    {data.topCategories.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-zinc-300">{cat.icon} {cat.name}</span>
                        </div>
                        <span className="text-zinc-400">{formatCurrency(Math.abs(cat.total))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[160px] flex items-center justify-center text-zinc-500">
                  No spending data
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Budget Utilization + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Utilization */}
        {dashboardLoading ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Budget Utilization</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : data ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              {data.budgetUtilization.length > 0 ? (
                <div className="space-y-4">
                  {data.budgetUtilization.map((b, i) => {
                    const pct = b.budgeted > 0 ? (Math.abs(b.spent) / b.budgeted) * 100 : 0
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-300">{b.category_icon} {b.category_name}</span>
                          <span className="text-zinc-400">
                            {formatCurrency(Math.abs(b.spent))} / {formatCurrency(b.budgeted)}
                          </span>
                        </div>
                        <Progress value={pct} indicatorColor={b.category_color} />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-500">
                  <p>No budgets set up yet</p>
                  <Link href="/budgets">
                    <Button variant="outline" size="sm" className="mt-2">Set up budgets</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Recent Transactions */}
        {dashboardLoading ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : data ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <Link href="/transactions">
                <Button variant="ghost" size="sm" className="text-xs">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {data.recentTransactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: (txn.category_color || '#6B7280') + '20' }}
                        >
                          {txn.category_icon || '📁'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">
                            {txn.display_name || txn.raw_description}
                          </p>
                          <p className="text-xs text-zinc-500">{formatDate(txn.date)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-medium shrink-0 ml-2 ${txn.amount >= 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-500">
                  <p>No transactions yet</p>
                  <Link href="/import">
                    <Button variant="outline" size="sm" className="mt-2">Import CSV</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Upcoming Bills */}
      {billsLoading ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Bills This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : bills.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Bills This Month
            </CardTitle>
            <Link href="/subscriptions">
              <Button variant="ghost" size="sm" className="text-xs">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bills
                .filter(b => b.isDue || b.isOverdue || b.isPaid)
                .slice(0, 6)
                .map(bill => (
                  <div key={bill.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/30">
                    <div className="flex items-center gap-2">
                      {bill.isPaid ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : bill.isOverdue ? (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <CalendarClock className="h-4 w-4 text-zinc-500" />
                      )}
                      <span className="text-sm text-zinc-200">{bill.category_icon} {bill.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCurrency(bill.amount)}</span>
                      <Badge variant={bill.isPaid ? "success" : bill.isOverdue ? "destructive" : "secondary"} className="text-xs">
                        {bill.isPaid ? "Paid" : bill.isOverdue ? "Overdue" : formatDate(bill.next_due_date)}
                      </Badge>
                    </div>
                  </div>
                ))}
              {bills.filter(b => b.isDue || b.isOverdue || b.isPaid).length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-2">No bills due this month</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Account Balances */}
      {dashboardLoading ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Account Balances</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : data && data.accountBalances.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.accountBalances.map((acc, i) => (
                <div key={i} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-800">
                  <p className="text-sm text-zinc-400">{acc.name}</p>
                  <p className="text-lg font-semibold mt-1">{formatCurrency(acc.balance)}</p>
                  <Badge variant="secondary" className="mt-2 text-xs capitalize">{acc.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center max-w-md space-y-6">
        <div className="text-6xl">💰</div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Welcome to CashFlow
        </h1>
        <p className="text-zinc-400">
          Your local-first personal finance app. All data stays on your machine.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-left">
            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-400">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">1. Create an account</p>
              <p className="text-xs text-zinc-500">Add your bank accounts to track</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-left">
            <div className="p-2 rounded-lg bg-emerald-600/10 text-emerald-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">2. Import transactions</p>
              <p className="text-xs text-zinc-500">Upload a CSV from your bank</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/settings">
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Create Account
            </Button>
          </Link>
          <Link href="/import">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-1" /> Import CSV
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}
