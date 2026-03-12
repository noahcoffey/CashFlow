"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { RECURRING_CONFIDENCE_THRESHOLD } from "@/lib/constants"
import { RefreshCw, CalendarClock, TrendingDown, Plus, Trash2, Check, AlertCircle } from "lucide-react"
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

interface Bill {
  id: string; name: string; amount: number; frequency: string
  next_due_date: string; isPaid: boolean; isDue: boolean; isOverdue: boolean
  category_icon: string | null; category_name: string | null
}

export default function SubscriptionsPage() {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([])
  const [totalMonthly, setTotalMonthly] = useState(0)
  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<Bill[]>([])
  const [showBillDialog, setShowBillDialog] = useState(false)
  const [billForm, setBillForm] = useState({
    name: "", amount: "", frequency: "monthly", next_due_date: ""
  })

  const fetchBills = () => {
    fetch("/api/bills").then(r => r.json()).then(d => setBills(d.bills || []))
  }

  const createBill = async () => {
    if (!billForm.name || !billForm.amount || !billForm.next_due_date) return
    await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: billForm.name,
        amount: -Math.abs(parseFloat(billForm.amount)),
        frequency: billForm.frequency,
        next_due_date: billForm.next_due_date,
      }),
    })
    setShowBillDialog(false)
    setBillForm({ name: "", amount: "", frequency: "monthly", next_due_date: "" })
    fetchBills()
    toast.success("Bill scheduled")
  }

  const createBillFromPattern = (p: RecurringPattern) => {
    setBillForm({
      name: p.merchant,
      amount: Math.abs(p.amount).toFixed(2),
      frequency: p.frequency,
      next_due_date: p.nextExpected,
    })
    setShowBillDialog(true)
  }

  const deleteBill = async (id: string) => {
    await fetch("/api/bills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchBills()
    toast.success("Bill removed")
  }

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

  useEffect(() => { fetch_(); fetchBills() }, [])

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
                        {p.confidence >= RECURRING_CONFIDENCE_THRESHOLD && (
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
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <div className="text-right">
                        <p className="font-medium text-zinc-200">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-zinc-500">{formatCurrency(p.totalAnnual)}/yr</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => createBillFromPattern(p)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Schedule
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Bills */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Scheduled Bills
            </CardTitle>
            <Button size="sm" onClick={() => setShowBillDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Bill
            </Button>
          </div>
          <CardDescription>Track upcoming and overdue bills</CardDescription>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No bills scheduled yet. Add one manually or click &quot;Schedule&quot; on a detected recurring charge above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bills.map(bill => (
                <div key={bill.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {bill.isPaid ? (
                      <Check className="h-5 w-5 text-green-400 shrink-0" />
                    ) : bill.isOverdue ? (
                      <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                    ) : (
                      <CalendarClock className="h-5 w-5 text-zinc-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-200 truncate">{bill.name}</p>
                        <Badge variant="secondary" className={`text-xs ${frequencyColor[bill.frequency]}`}>
                          {frequencyLabel[bill.frequency]}
                        </Badge>
                        {bill.isPaid && <Badge variant="success" className="text-xs">Paid</Badge>}
                        {bill.isOverdue && !bill.isPaid && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Due: {formatDate(bill.next_due_date)}
                        {bill.category_name && ` · ${bill.category_icon || ''} ${bill.category_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <p className="font-medium text-zinc-200">{formatCurrency(bill.amount)}</p>
                    <Button variant="ghost" size="sm" onClick={() => deleteBill(bill.id)}>
                      <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill Creation Dialog */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Name</label>
              <Input
                value={billForm.name}
                onChange={e => setBillForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Netflix, Rent, Electric"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={billForm.amount}
                onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Frequency</label>
              <Select
                value={billForm.frequency}
                onChange={e => setBillForm(f => ({ ...f, frequency: e.target.value }))}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </Select>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Next Due Date</label>
              <Input
                type="date"
                value={billForm.next_due_date}
                onChange={e => setBillForm(f => ({ ...f, next_due_date: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={createBill}>
              <Plus className="h-4 w-4 mr-1" /> Schedule Bill
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
