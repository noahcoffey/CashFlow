"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Search, Filter, ChevronLeft, ChevronRight, Save, X, Tags, Trash2, Bookmark } from "lucide-react"
import { toast } from "sonner"

interface Transaction {
  id: string
  account_id: string
  date: string
  amount: number
  raw_description: string
  display_name: string
  category_id: string | null
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  account_name: string
  is_reconciled: number
  notes: string
}

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: string
}

interface Account {
  id: string
  name: string
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [accountFilter, setAccountFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [editForm, setEditForm] = useState({ display_name: "", category_id: "", notes: "" })
  const [editTab, setEditTab] = useState<"edit" | "alias">("edit")
  const [aliasForm, setAliasForm] = useState({ raw_pattern: "", display_name: "", category_id: "" })
  const [aliasApplyAll, setAliasApplyAll] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState("")
  const [showBulk, setShowBulk] = useState(false)

  const limit = 25

  const fetchTransactions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set("search", search)
    if (accountFilter) params.set("accountId", accountFilter)
    if (categoryFilter) params.set("categoryId", categoryFilter)
    if (dateFrom) params.set("startDate", dateFrom)
    if (dateTo) params.set("endDate", dateTo)

    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.transactions || [])
        setTotal(data.total || 0)
      })
      .finally(() => setLoading(false))
  }, [page, search, accountFilter, categoryFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []))
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts || []))
  }, [])

  const totalPages = Math.ceil(total / limit)

  const startEdit = (txn: Transaction) => {
    setEditingId(txn.id)
    setEditingTxn(txn)
    setEditTab("edit")
    setEditForm({
      display_name: txn.display_name || "",
      category_id: txn.category_id || "",
      notes: txn.notes || "",
    })
    // Pre-fill alias form: extract a likely pattern from the raw description
    const rawUpper = txn.raw_description.toUpperCase()
    // Try to extract the merchant name portion (often after "—" separator or the main text)
    const parts = txn.raw_description.split("—").map(s => s.trim())
    const patternBase = parts.length > 1 ? parts[1].split(/\s{2,}/)[0].split(/\d{5,}/)[0].trim() : txn.raw_description.split(/\d{5,}/)[0].trim()
    setAliasForm({
      raw_pattern: patternBase || txn.raw_description,
      display_name: txn.display_name || "",
      category_id: txn.category_id || "",
    })
    setAliasApplyAll(true)
  }

  const saveEdit = async () => {
    if (!editingId) return
    await fetch("/api/transactions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editForm }),
    })
    setEditingId(null)
    setEditingTxn(null)
    fetchTransactions()
    toast.success("Transaction updated")
  }

  const saveAlias = async () => {
    if (!aliasForm.raw_pattern || !aliasForm.display_name) {
      toast.error("Pattern and display name are required")
      return
    }
    const res = await fetch("/api/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...aliasForm, apply_retroactively: aliasApplyAll }),
    })
    const data = await res.json()
    setEditingId(null)
    setEditingTxn(null)
    fetchTransactions()
    if (data.retroactive?.matched > 0) {
      toast.success(`Alias created — matched ${data.retroactive.matched} transaction${data.retroactive.matched > 1 ? "s" : ""}`)
    } else {
      toast.success("Alias created")
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(transactions.map((t) => t.id)))
    }
  }

  const bulkCategorize = async () => {
    if (!bulkCategoryId || selected.size === 0) return
    await fetch("/api/transactions/bulk", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), category_id: bulkCategoryId }),
    })
    setSelected(new Set())
    setShowBulk(false)
    fetchTransactions()
    toast.success(`${selected.size} transactions categorized`)
  }

  const deleteTransaction = async (id: string) => {
    await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setEditingId(null)
    setEditingTxn(null)
    fetchTransactions()
    toast.success("Transaction deleted")
  }

  const bulkDelete = async () => {
    if (selected.size === 0) return
    const count = selected.size
    await fetch("/api/transactions/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    })
    setSelected(new Set())
    fetchTransactions()
    toast.success(`${count} transactions deleted`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-zinc-500 text-sm">{total} total transactions</p>
        </div>
        {selected.size > 0 && (
          <div className="flex gap-2">
            <Button onClick={() => setShowBulk(true)} variant="secondary">
              <Tags className="h-4 w-4 mr-1" /> Categorize {selected.size}
            </Button>
            <Button onClick={bulkDelete} variant="destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete {selected.size}
            </Button>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" /> Filters
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-zinc-800">
              <Select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPage(1) }}>
                <option value="">All Accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}>
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} placeholder="From" />
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} placeholder="To" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <p className="text-lg">No transactions found</p>
              <p className="text-sm mt-1">Try adjusting your filters or import some data</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="p-4 w-10">
                      <Checkbox checked={selected.size === transactions.length && transactions.length > 0} onCheckedChange={selectAll} />
                    </th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Account</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => startEdit(txn)}
                    >
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(txn.id)}
                          onCheckedChange={() => toggleSelect(txn.id)}
                        />
                      </td>
                      <td className="p-4 text-sm text-zinc-400 whitespace-nowrap">{formatDate(txn.date)}</td>
                      <td className="p-4">
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{txn.display_name || txn.raw_description}</p>
                          {txn.display_name && txn.display_name !== txn.raw_description && (
                            <p className="text-xs text-zinc-600 truncate max-w-xs">{txn.raw_description}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {txn.category_name ? (
                          <Badge
                            style={{ backgroundColor: (txn.category_color || '#6B7280') + '20', color: txn.category_color || '#6B7280' }}
                            className="border-0"
                          >
                            {txn.category_icon} {txn.category_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-zinc-500">Uncategorized</Badge>
                        )}
                      </td>
                      <td className="p-4 text-sm text-zinc-400">{txn.account_name}</td>
                      <td className={`p-4 text-sm font-medium text-right ${txn.amount >= 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </td>
                      <td className="p-4">
                        {txn.is_reconciled ? (
                          <Badge variant="success" className="text-xs">R</Badge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editingId !== null} onOpenChange={() => { setEditingId(null); setEditingTxn(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            {editingTxn && (
              <p className="text-xs text-zinc-500 truncate mt-1 font-normal">{editingTxn.raw_description}</p>
            )}
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-zinc-800 -mx-6 px-6">
            <button
              onClick={() => setEditTab("edit")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                editTab === "edit"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setEditTab("alias")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                editTab === "alias"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" /> Create Alias
            </button>
          </div>

          {editTab === "edit" ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Display Name</label>
                <Input
                  value={editForm.display_name}
                  onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                  placeholder="e.g. Starbucks"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Category</label>
                <Select
                  value={editForm.category_id}
                  onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Notes</label>
                <Input
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex justify-between">
                <Button variant="destructive" onClick={() => editingId && deleteTransaction(editingId)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setEditingId(null); setEditingTxn(null) }}>Cancel</Button>
                  <Button onClick={saveEdit}>
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-zinc-800/50 text-xs text-zinc-400 space-y-1">
                <p>Create a reusable alias so all transactions matching this pattern get automatically named and categorized.</p>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Match Pattern *</label>
                <Input
                  value={aliasForm.raw_pattern}
                  onChange={(e) => setAliasForm({ ...aliasForm, raw_pattern: e.target.value })}
                  placeholder="e.g. STARBKS"
                />
                <p className="text-xs text-zinc-600 mt-1">Contains match — any transaction with this text will match</p>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Display Name *</label>
                <Input
                  value={aliasForm.display_name}
                  onChange={(e) => setAliasForm({ ...aliasForm, display_name: e.target.value })}
                  placeholder="e.g. Starbucks"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Category</label>
                <Select
                  value={aliasForm.category_id}
                  onChange={(e) => setAliasForm({ ...aliasForm, category_id: e.target.value })}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={aliasApplyAll} onCheckedChange={(v) => setAliasApplyAll(!!v)} />
                <span className="text-sm text-zinc-300">Apply to all existing transactions</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditingId(null); setEditingTxn(null) }}>Cancel</Button>
                <Button onClick={saveAlias} disabled={!aliasForm.raw_pattern || !aliasForm.display_name}>
                  <Bookmark className="h-4 w-4 mr-1" /> Create Alias
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Categorize Dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Categorize ({selected.size} transactions)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBulk(false)}>Cancel</Button>
              <Button onClick={bulkCategorize} disabled={!bulkCategoryId}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
