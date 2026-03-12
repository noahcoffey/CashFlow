"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { BUDGET_WARNING_THRESHOLD, BUDGET_OVER_THRESHOLD } from "@/lib/constants"
import { Plus, Edit2, Trash2, TrendingUp, ChevronRight } from "lucide-react"
import { toast } from "sonner"

interface SpendingHistory {
  category_id: string
  category_name: string
  category_icon: string
  category_color: string
  averages: Record<number, number>
}

interface BudgetItem {
  id: string
  category_id: string
  category_name: string
  category_icon: string
  category_color: string
  amount: number
  period: string
  spent: number
}

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: string
  parent_id: string | null
  budget_amount: number
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editForm, setEditForm] = useState({ category_id: "", amount: "", period: "monthly" })
  const [formErrors, setFormErrors] = useState<{ category_id?: string; amount?: string }>({})
  const [showCatDialog, setShowCatDialog] = useState(false)
  const [catForm, setCatForm] = useState({ id: "", name: "", icon: "📁", color: "#6B7280", type: "expense", parent_id: "", budget_amount: "0" })
  const [spendingHistory, setSpendingHistory] = useState<SpendingHistory[]>([])
  const [historyPeriod, setHistoryPeriod] = useState<number>(3)
  const [historyLoading, setHistoryLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      fetch("/api/budgets").then((r) => { if (!r.ok) throw new Error("Failed to load budgets"); return r.json() }),
      fetch("/api/categories").then((r) => { if (!r.ok) throw new Error("Failed to load categories"); return r.json() }),
    ]).then(([budgetData, catData]) => {
      setBudgets(budgetData.budgets || [])
      setCategories(catData.categories || [])
    }).catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  const fetchHistory = () => {
    setHistoryLoading(true)
    fetch("/api/budgets/history")
      .then(r => { if (!r.ok) throw new Error("Failed to load spending history"); return r.json() })
      .then(d => { setSpendingHistory(d.categories || []) })
      .catch((err) => toast.error(err.message))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => { fetchData(); fetchHistory() }, [])

  const saveBudget = async () => {
    const errors: { category_id?: string; amount?: string } = {}
    if (!editForm.category_id) errors.category_id = "Category is required"
    const parsed = parseFloat(editForm.amount)
    if (!editForm.amount || isNaN(parsed)) errors.amount = "Amount must be a valid number"
    else if (parsed <= 0) errors.amount = "Amount must be greater than zero"
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: editForm.category_id,
        amount: parseFloat(editForm.amount),
        period: editForm.period,
      }),
    })
    setShowDialog(false)
    setEditForm({ category_id: "", amount: "", period: "monthly" })
    fetchData()
    toast.success("Budget saved")
  }

  const saveCategory = async () => {
    if (!catForm.name) return
    const method = catForm.id ? "PUT" : "POST"
    await fetch("/api/categories", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: catForm.id || undefined,
        name: catForm.name,
        icon: catForm.icon,
        color: catForm.color,
        type: catForm.type,
        parent_id: catForm.parent_id || null,
        budget_amount: parseFloat(catForm.budget_amount) || 0,
      }),
    })
    setShowCatDialog(false)
    setCatForm({ id: "", name: "", icon: "📁", color: "#6B7280", type: "expense", parent_id: "", budget_amount: "0" })
    fetchData()
    toast.success("Category saved")
  }

  const deleteCategory = async (id: string) => {
    await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchData()
    toast.success("Category deleted")
  }

  const editCategory = (cat: Category) => {
    setCatForm({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
      parent_id: cat.parent_id || "",
      budget_amount: String(cat.budget_amount || 0),
    })
    setShowCatDialog(true)
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + Math.abs(b.spent), 0)

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets & Categories</h1>
          <p className="text-zinc-500 text-sm">Manage your spending limits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCatDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Category
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Budget
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-400">Total Budget</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-400">Total Spent</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-400">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${totalBudget - totalSpent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(totalBudget - totalSpent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spending History Reference */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Spending History</CardTitle>
            <p className="text-sm text-zinc-500 mt-1">Average monthly spend by category to help set budgets</p>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 6, 12].map(m => (
              <Button
                key={m}
                variant={historyPeriod === m ? "default" : "outline"}
                size="sm"
                className="text-xs px-2.5"
                onClick={() => setHistoryPeriod(m)}
              >
                {m === 1 ? "1 mo" : m === 12 ? "1 yr" : `${m} mo`}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : spendingHistory.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No spending data found. Import transactions to see history.</p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-0 items-center text-xs text-zinc-500 pb-2 border-b border-zinc-800 mb-1">
                <span></span>
                <span>Category</span>
                <span className="text-right">Avg / Month</span>
                <span></span>
              </div>
              {spendingHistory.map(cat => {
                const avg = cat.averages[historyPeriod] || 0
                if (avg === 0) return null
                const maxAvg = Math.max(...spendingHistory.map(c => c.averages[historyPeriod] || 0))
                const barPct = maxAvg > 0 ? (avg / maxAvg) * 100 : 0
                const hasBudget = budgets.some(b => b.category_id === cat.category_id)
                return (
                  <div key={cat.category_id} className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-center py-2 group">
                    <span className="text-base">{cat.category_icon}</span>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm text-zinc-200 shrink-0">{cat.category_name}</span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${barPct}%`, backgroundColor: cat.category_color }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-zinc-200 text-right tabular-nums">
                      {formatCurrency(avg)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setEditForm({
                          category_id: cat.category_id,
                          amount: Math.round(avg).toString(),
                          period: "monthly",
                        })
                        setShowDialog(true)
                      }}
                    >
                      {hasBudget ? "Update" : "Set"} <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget vs Actual */}
      <Card>
        <CardHeader>
          <CardTitle>Budget vs Actual</CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.length > 0 ? (
            <div className="space-y-5">
              {budgets.map((b) => {
                const spent = Math.abs(b.spent)
                const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0
                const remaining = b.amount - spent
                return (
                  <div key={b.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{b.category_icon}</span>
                        <span className="font-medium text-zinc-200">{b.category_name}</span>
                        <Badge variant={pct > BUDGET_OVER_THRESHOLD ? "destructive" : pct > BUDGET_WARNING_THRESHOLD ? "warning" : "success"} className="text-xs">
                          {pct.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="text-sm text-zinc-400">
                        {formatCurrency(spent)} / {formatCurrency(b.amount)}
                        <span className={`ml-2 ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ({remaining >= 0 ? '+' : ''}{formatCurrency(remaining)})
                        </span>
                      </div>
                    </div>
                    <Progress value={pct} indicatorColor={b.category_color} />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500">
              <p>No budgets set up yet</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowDialog(true)}>
                Create your first budget
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {categories.filter(c => !c.parent_id).map((cat) => {
              const children = categories.filter(c => c.parent_id === cat.id)
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span>{cat.icon}</span>
                      <span className="font-medium text-zinc-200">{cat.name}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{cat.type}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editCategory(cat)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteCategory(cat.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between py-2 px-3 pl-10 rounded-lg hover:bg-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: child.color }} />
                        <span>{child.icon}</span>
                        <span className="text-zinc-300">{child.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editCategory(child)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteCategory(child.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Budget Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Category</label>
              <Select value={editForm.category_id} onChange={(e) => { setEditForm({ ...editForm, category_id: e.target.value }); setFormErrors(prev => ({ ...prev, category_id: undefined })) }}>
                <option value="">Select category</option>
                {categories.filter(c => c.type === 'expense').map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </Select>
              {formErrors.category_id && <p className="text-xs text-red-400 mt-1">{formErrors.category_id}</p>}
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Amount</label>
              <Input type="number" value={editForm.amount} onChange={(e) => { setEditForm({ ...editForm, amount: e.target.value }); setFormErrors(prev => ({ ...prev, amount: undefined })) }} placeholder="500" />
              {formErrors.amount && <p className="text-xs text-red-400 mt-1">{formErrors.amount}</p>}
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Period</label>
              <Select value={editForm.period} onChange={(e) => setEditForm({ ...editForm, period: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="annual">Annual</option>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={saveBudget}>Save Budget</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catForm.id ? "Edit" : "New"} Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Name</label>
                <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Type</label>
                <Select value={catForm.type} onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Icon</label>
                <Input value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Color</label>
                <Input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} className="h-10 p-1" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Budget</label>
                <Input type="number" value={catForm.budget_amount} onChange={(e) => setCatForm({ ...catForm, budget_amount: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Parent Category</label>
              <Select value={catForm.parent_id} onChange={(e) => setCatForm({ ...catForm, parent_id: e.target.value })}>
                <option value="">None (top-level)</option>
                {categories.filter(c => !c.parent_id).map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCatDialog(false)}>Cancel</Button>
              <Button onClick={saveCategory}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
