"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import { RefreshCw, CalendarClock, TrendingDown } from "lucide-react"
import { toast } from "sonner"

interface RecurringPattern {
  merchant: string
  amount: number
  frequency: string
  confidence: number
  lastDate: string
  nextExpected: string
  occurrences: number
  totalAnnual: number
  transactionIds: string[]
}

export default function SubscriptionsPage() {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([])
  const [totalMonthly, setTotalMonthly] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetch_ = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/transactions/recurring")
      const data = await res.json()
      setPatterns(data.patterns || [])
      setTotalMonthly(data.totalMonthly || 0)
    } catch {
      toast.error("Failed to load recurring transactions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch_() }, [])

  const totalAnnual = patterns.reduce((s, p) => s + p.totalAnnual, 0)

  const frequencyLabel: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annual: "Annual",
  }

  const frequencyColor: Record<string, string> = {
    weekly: "text-red-400",
    biweekly: "text-orange-400",
    monthly: "text-blue-400",
    quarterly: "text-purple-400",
    annual: "text-zinc-400",
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="h-6 w-6" /> Subscriptions & Recurring
          </h1>
          <p className="text-zinc-500 text-sm">Auto-detected from your transaction history</p>
        </div>
        <Button variant="outline" onClick={fetch_} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-400">Monthly Cost</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{formatCurrency(totalMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-400">Annual Cost</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{formatCurrency(totalAnnual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-400">Recurring Items</p>
            <p className="text-2xl font-bold mt-1">{patterns.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recurring List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" /> Detected Recurring Charges
          </CardTitle>
          <CardDescription>Sorted by annual cost</CardDescription>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No recurring transactions detected yet. Import more transaction history for better detection.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {patterns.map((p, idx) => {
                const isOverdue = p.nextExpected < new Date().toISOString().substring(0, 10)
                return (
                  <div key={idx} className="flex items-center justify-between py-3 px-4 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-200 truncate">{p.merchant}</p>
                        <Badge variant="secondary" className={`text-xs ${frequencyColor[p.frequency]}`}>
                          {frequencyLabel[p.frequency]}
                        </Badge>
                        {p.confidence >= 0.8 && (
                          <Badge variant="success" className="text-xs">High confidence</Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-zinc-500 mt-0.5">
                        <span>Last: {formatDate(p.lastDate)}</span>
                        <span className={isOverdue ? 'text-amber-400' : ''}>
                          Next: {formatDate(p.nextExpected)}{isOverdue ? ' (overdue)' : ''}
                        </span>
                        <span>{p.occurrences} occurrences</span>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="font-medium text-zinc-200">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-zinc-500">{formatCurrency(p.totalAnnual)}/yr</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
