"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { Download } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts"

type ReportType = "spending-by-category" | "monthly-trends" | "income-vs-expenses" | "net-worth"

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("spending-by-category")
  const [rawData, setRawData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ type: reportType })
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then(setRawData)
      .finally(() => setLoading(false))
  }, [reportType, startDate, endDate])

  const exportCSV = () => {
    if (!rawData?.data?.length) return
    const rows = rawData.data
    const keys = Object.keys(rows[0] || {})
    const csv = [keys.join(","), ...rows.map((r: any) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#06B6D4"]

  const hasData = rawData?.data?.length > 0

  // Transform monthly-trends data into flat rows for Recharts
  const getTrendData = () => {
    if (!rawData?.data) return { rows: [], categories: [] as string[] }
    const catSet = new Set<string>()
    rawData.data.forEach((m: any) => m.categories?.forEach((c: any) => catSet.add(c.name)))
    const categories = Array.from(catSet)
    const rows = rawData.data.map((m: any) => {
      const row: any = { month: m.month }
      categories.forEach(c => { row[c] = 0 })
      m.categories?.forEach((c: any) => { row[c.name] = c.total })
      return row
    })
    return { rows, categories }
  }

  // Transform net-worth data
  const getNetWorthData = () => {
    if (!rawData?.data) return []
    return rawData.data.map((m: any) => ({ month: m.month, ...m.balances, total: m.total }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-zinc-500 text-sm">Analyze your financial data</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!hasData}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="w-auto">
              <option value="spending-by-category">Spending by Category</option>
              <option value="monthly-trends">Monthly Trends</option>
              <option value="income-vs-expenses">Income vs Expenses</option>
              <option value="net-worth">Net Worth Over Time</option>
            </Select>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {reportType === "spending-by-category" && "Spending by Category"}
              {reportType === "monthly-trends" && "Monthly Spending Trends"}
              {reportType === "income-vs-expenses" && "Income vs Expenses"}
              {reportType === "net-worth" && "Net Worth Over Time"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="h-96 flex items-center justify-center text-zinc-500">
                No data available for this report
              </div>
            ) : (
              <>
                {reportType === "spending-by-category" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={rawData.data.map((r: any) => ({ name: r.name, value: Math.abs(r.total) }))}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={130}
                          dataKey="value" stroke="none"
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {rawData.data.map((r: any, i: number) => (
                            <Cell key={i} fill={r.color || COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {rawData.data.map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/30">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color || COLORS[i % COLORS.length] }} />
                            <span className="text-sm text-zinc-300">{r.icon} {r.name}</span>
                          </div>
                          <span className="text-sm font-medium">{formatCurrency(Math.abs(r.total))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportType === "monthly-trends" && (() => {
                  const { rows, categories } = getTrendData()
                  return (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={rows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                        <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Legend />
                        {categories.map((cat, i) => (
                          <Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )
                })()}

                {reportType === "income-vs-expenses" && (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={rawData.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Legend />
                      <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {reportType === "net-worth" && (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={getNetWorthData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Legend />
                      {rawData.accounts?.map((acc: string, i: number) => (
                        <Line key={acc} type="monotone" dataKey={acc} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
                      ))}
                      <Line type="monotone" dataKey="total" stroke="#fafafa" strokeWidth={2} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
