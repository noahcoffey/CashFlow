"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Search, Filter, ChevronLeft, ChevronRight, Save, X, Tags, Trash2, Bookmark, Download, Copy, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface Tag {
  id: string
  name: string
  color: string
  usage_count?: number
}

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
  tags: Tag[]
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

function SplitActions({ splits, txnAmount, onAddRow, onRemoveSplit, onCancel, onSave }: {
  splits: Array<{ amount: string }>
  txnAmount: number
  onAddRow: () => void
  onRemoveSplit: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const splitSum = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const balanced = Math.abs(splitSum - txnAmount) < 0.01
  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="sm" onClick={onAddRow} className="text-xs">
          + Add Row
        </Button>
        <span className={`text-xs ${balanced ? 'text-emerald-400' : 'text-red-400'}`}>
          {balanced ? 'Balanced' : `Remaining: ${formatCurrency(txnAmount - splitSum)}`}
        </span>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onRemoveSplit} className="text-xs">
          Remove Split
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={!balanced || splits.length < 2}>Save Split</Button>
        </div>
      </div>
    </>
  )
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const [accountFilter, setAccountFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [editForm, setEditForm] = useState({ display_name: "", category_id: "", notes: "" })
  const [editTab, setEditTab] = useState<"edit" | "alias" | "split">("edit")
  const [splits, setSplits] = useState<Array<{ category_id: string; amount: string; description: string }>>([])
  const [splitsLoading, setSplitsLoading] = useState(false)
  const [aliasForm, setAliasForm] = useState({ raw_pattern: "", display_name: "", category_id: "" })
  const [aliasApplyAll, setAliasApplyAll] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState("")
  const [showBulk, setShowBulk] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{
    key: string
    transactions: Array<{
      id: string; date: string; amount: number; raw_description: string;
      display_name: string; account_name: string | null; category_name: string | null;
      category_icon: string | null; created_at: string
    }>
  }>>([])
  const [duplicatesLoading, setDuplicatesLoading] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [tagFilter, setTagFilter] = useState("")
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#6B7280")

  const pendingDeleteRef = useRef<{ timer: ReturnType<typeof setTimeout>; toastId: string | number } | null>(null)

  const limit = 25

  const fetchTransactions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (accountFilter) params.set("accountId", accountFilter)
    if (categoryFilter) params.set("categoryId", categoryFilter)
    if (dateFrom) params.set("startDate", dateFrom)
    if (dateTo) params.set("endDate", dateTo)
    if (tagFilter) params.set("tagId", tagFilter)

    setError(null)
    fetch(`/api/transactions?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load transactions (${r.status})`)
        return r.json()
      })
      .then((data) => {
        setTransactions(data.transactions || [])
        setTotal(data.total || 0)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, accountFilter, categoryFilter, dateFrom, dateTo, tagFilter])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => { if (!r.ok) throw new Error("Failed to load categories"); return r.json() })
      .then((d) => setCategories(d.categories || []))
      .catch(() => toast.error("Failed to load categories"))
    fetch("/api/accounts")
      .then((r) => { if (!r.ok) throw new Error("Failed to load accounts"); return r.json() })
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => toast.error("Failed to load accounts"))
    fetch("/api/tags")
      .then((r) => { if (!r.ok) throw new Error("Failed to load tags"); return r.json() })
      .then((d) => setTags(d.tags || []))
      .catch(() => toast.error("Failed to load tags"))
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
    // Fetch existing splits
    setSplits([])
    fetch(`/api/transactions/splits?transactionId=${txn.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.splits?.length > 0) {
          setSplits(d.splits.map((s: { category_id?: string; amount: number; description?: string }) => ({
            category_id: s.category_id || "",
            amount: String(s.amount),
            description: s.description || "",
          })))
        }
      })
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
    const count = selected.size
    const ids = Array.from(selected)
    const prev = transactions
    const cat = categories.find(c => c.id === bulkCategoryId)
    setTransactions(t => t.map(txn =>
      selected.has(txn.id)
        ? { ...txn, category_id: bulkCategoryId, category_name: cat?.name || null, category_icon: cat?.icon || null, category_color: cat?.color || null }
        : txn
    ))
    setSelected(new Set())
    setShowBulk(false)
    toast.success(`${count} transactions categorized`)

    try {
      const res = await fetch("/api/transactions/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, category_id: bulkCategoryId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTransactions(prev)
      toast.error("Failed to categorize transactions")
    }
  }

  const deleteTransaction = (id: string) => {
    // Cancel any pending delete
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer)
      toast.dismiss(pendingDeleteRef.current.toastId)
      pendingDeleteRef.current = null
    }

    const prev = transactions
    const prevTotal = total
    setTransactions(t => t.filter(txn => txn.id !== id))
    setTotal(t => t - 1)
    setEditingId(null)
    setEditingTxn(null)

    const toastId = toast("Transaction deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          if (pendingDeleteRef.current) {
            clearTimeout(pendingDeleteRef.current.timer)
            pendingDeleteRef.current = null
          }
          setTransactions(prev)
          setTotal(prevTotal)
          toast.success("Transaction restored")
        },
      },
      duration: 5000,
    })

    const timer = setTimeout(async () => {
      pendingDeleteRef.current = null
      try {
        const res = await fetch("/api/transactions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setTransactions(prev)
        setTotal(prevTotal)
        toast.error("Failed to delete transaction")
      }
    }, 5000)

    pendingDeleteRef.current = { timer, toastId }
  }

  const bulkDelete = () => {
    if (selected.size === 0) return
    // Cancel any pending delete
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer)
      toast.dismiss(pendingDeleteRef.current.toastId)
      pendingDeleteRef.current = null
    }

    const count = selected.size
    const ids = Array.from(selected)
    const prev = transactions
    const prevTotal = total
    setTransactions(t => t.filter(txn => !selected.has(txn.id)))
    setTotal(t => t - count)
    setSelected(new Set())

    const toastId = toast(`${count} transactions deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (pendingDeleteRef.current) {
            clearTimeout(pendingDeleteRef.current.timer)
            pendingDeleteRef.current = null
          }
          setTransactions(prev)
          setTotal(prevTotal)
          toast.success(`${count} transactions restored`)
        },
      },
      duration: 5000,
    })

    const timer = setTimeout(async () => {
      pendingDeleteRef.current = null
      try {
        const res = await fetch("/api/transactions/bulk", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setTransactions(prev)
        setTotal(prevTotal)
        toast.error("Failed to delete transactions")
      }
    }, 5000)

    pendingDeleteRef.current = { timer, toastId }
  }

  const saveSplits = async () => {
    if (!editingTxn) return
    const splitData = splits.map(s => ({
      category_id: s.category_id || null,
      amount: parseFloat(s.amount) || 0,
      description: s.description,
    }))
    const res = await fetch("/api/transactions/splits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: editingTxn.id, splits: splitData }),
    })
    const data = await res.json()
    if (res.ok) {
      setEditingId(null)
      setEditingTxn(null)
      fetchTransactions()
      toast.success(splits.length > 1 ? `Split into ${splits.length} categories` : "Split removed")
    } else {
      toast.error(data.error || "Failed to save splits")
    }
  }

  const addSplitRow = () => {
    if (!editingTxn) return
    const existingSum = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const remaining = editingTxn.amount - existingSum
    setSplits([...splits, { category_id: "", amount: remaining.toFixed(2), description: "" }])
  }

  const initSplit = () => {
    if (!editingTxn) return
    if (splits.length === 0) {
      // Initialize with 2 rows: first with full amount, second empty
      setSplits([
        { category_id: editingTxn.category_id || "", amount: editingTxn.amount.toFixed(2), description: "" },
        { category_id: "", amount: "0.00", description: "" },
      ])
    }
    setEditTab("split")
  }

  const scanDuplicates = async () => {
    setDuplicatesLoading(true)
    setShowDuplicates(true)
    try {
      const res = await fetch("/api/transactions/duplicates")
      const data = await res.json()
      setDuplicateGroups(data.groups || [])
    } catch {
      toast.error("Failed to scan for duplicates")
    } finally {
      setDuplicatesLoading(false)
    }
  }

  const deleteDuplicate = async (id: string) => {
    await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    // Remove from local state
    setDuplicateGroups(prev =>
      prev
        .map(g => ({ ...g, transactions: g.transactions.filter(t => t.id !== id) }))
        .filter(g => g.transactions.length >= 2)
    )
    fetchTransactions()
    toast.success("Duplicate removed")
  }

  const createTag = async () => {
    if (!newTagName.trim()) return
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
    })
    if (res.ok) {
      const data = await res.json()
      setTags(prev => [...prev, { ...data.tag, usage_count: 0 }])
      setNewTagName("")
      setNewTagColor("#6B7280")
      setShowTagDialog(false)
      toast.success("Tag created")
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to create tag")
    }
  }

  const bulkTag = async (tagId: string) => {
    if (selected.size === 0) return
    const count = selected.size
    const ids = Array.from(selected)
    const prev = transactions
    const tag = tags.find(t => t.id === tagId)
    if (tag) {
      setTransactions(t => t.map(txn =>
        selected.has(txn.id) && !txn.tags?.some(t => t.id === tagId)
          ? { ...txn, tags: [...(txn.tags || []), tag] }
          : txn
      ))
    }
    setSelected(new Set())
    toast.success(`Tagged ${count} transactions`)

    try {
      const res = await fetch("/api/transactions/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_ids: ids, tag_id: tagId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTransactions(prev)
      toast.error("Failed to tag transactions")
    }
  }

  const toggleTag = async (txnId: string, tagId: string, hasTag: boolean) => {
    const prev = transactions
    const tag = tags.find(t => t.id === tagId)
    setTransactions(t => t.map(txn => {
      if (txn.id !== txnId) return txn
      return {
        ...txn,
        tags: hasTag
          ? (txn.tags || []).filter(t => t.id !== tagId)
          : [...(txn.tags || []), ...(tag ? [tag] : [])],
      }
    }))

    try {
      const res = await fetch("/api/transactions/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_ids: [txnId],
          tag_id: tagId,
          action: hasTag ? "remove" : "add",
        }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTransactions(prev)
      toast.error("Failed to update tag")
    }
  }

  const exportCSV = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (accountFilter) params.set("accountId", accountFilter)
    if (categoryFilter) params.set("categoryId", categoryFilter)
    if (dateFrom) params.set("startDate", dateFrom)
    if (dateTo) params.set("endDate", dateTo)
    window.open(`/api/transactions/export?${params}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-zinc-500 text-sm">{total} total transactions</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Button onClick={() => setShowBulk(true)} variant="secondary">
                <Tags className="h-4 w-4 mr-1" /> Categorize {selected.size}
              </Button>
              {tags.length > 0 && (
                <Select
                  value=""
                  onChange={(e) => { if (e.target.value) bulkTag(e.target.value) }}
                  className="w-40"
                >
                  <option value="">Tag {selected.size}...</option>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              )}
              <Button onClick={bulkDelete} variant="destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Delete {selected.size}
              </Button>
            </>
          )}
          <Button onClick={scanDuplicates} variant="outline">
            <Copy className="h-4 w-4 mr-1" /> Duplicates
          </Button>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
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
              <div className="flex gap-2">
                <Select value={tagFilter} onChange={(e) => { setTagFilter(e.target.value); setPage(1) }} className="flex-1">
                  <option value="">All Tags</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowTagDialog(true)} className="shrink-0 text-xs">
                  + Tag
                </Button>
              </div>
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
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="text-lg text-zinc-200">Failed to load transactions</p>
              <p className="text-sm text-zinc-500 mt-1 mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchTransactions}>Try again</Button>
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
                        {txn.tags?.map(tag => (
                          <Badge key={tag.id} className="text-xs ml-1" style={{ backgroundColor: tag.color + '22', color: tag.color, borderColor: tag.color + '44' }}>
                            {tag.name}
                          </Badge>
                        ))}
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
            <button
              onClick={initSplit}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                editTab === "split"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Split
              {splits.length > 1 && <Badge variant="secondary" className="ml-1.5 text-xs">{splits.length}</Badge>}
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
              {tags.length > 0 && editingTxn && (
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => {
                      const hasTag = editingTxn.tags?.some(t => t.id === tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => {
                            toggleTag(editingTxn.id, tag.id, !!hasTag)
                            setEditingTxn({
                              ...editingTxn,
                              tags: hasTag
                                ? editingTxn.tags.filter(t => t.id !== tag.id)
                                : [...(editingTxn.tags || []), tag],
                            })
                          }}
                          className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                            hasTag
                              ? 'border-current'
                              : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                          }`}
                          style={hasTag ? { color: tag.color, borderColor: tag.color, backgroundColor: tag.color + '22' } : {}}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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
          ) : editTab === "alias" ? (
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
          ) : editTab === "split" ? (
            <div className="space-y-3">
              {editingTxn && (
                <p className="text-xs text-zinc-500">
                  Total: {formatCurrency(editingTxn.amount)} — Split across categories
                </p>
              )}
              {splits.map((split, idx) => {
                const splitSum = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                return (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      {idx === 0 && <label className="text-xs text-zinc-500 mb-0.5 block">Category</label>}
                      <Select
                        value={split.category_id}
                        onChange={(e) => {
                          const updated = [...splits]
                          updated[idx] = { ...updated[idx], category_id: e.target.value }
                          setSplits(updated)
                        }}
                      >
                        <option value="">Select category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </Select>
                    </div>
                    <div className="w-28">
                      {idx === 0 && <label className="text-xs text-zinc-500 mb-0.5 block">Amount</label>}
                      <Input
                        type="number"
                        step="0.01"
                        value={split.amount}
                        onChange={(e) => {
                          const updated = [...splits]
                          updated[idx] = { ...updated[idx], amount: e.target.value }
                          setSplits(updated)
                        }}
                      />
                    </div>
                    {splits.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-400 shrink-0"
                        onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
              {editingTxn && (
                <SplitActions
                  splits={splits}
                  txnAmount={editingTxn.amount}
                  onAddRow={addSplitRow}
                  onRemoveSplit={() => { setSplits([]); saveSplits() }}
                  onCancel={() => { setEditingId(null); setEditingTxn(null) }}
                  onSave={saveSplits}
                />
              )}
            </div>
          ) : null}
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

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicate Detection</DialogTitle>
          </DialogHeader>
          {duplicatesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : duplicateGroups.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No potential duplicates found.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">{duplicateGroups.length} potential duplicate group{duplicateGroups.length !== 1 ? 's' : ''} found</p>
              {duplicateGroups.map((group) => (
                <div key={group.key} className="border border-zinc-800 rounded-lg p-3 space-y-2">
                  {group.transactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between py-2 px-3 rounded bg-zinc-800/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">
                            {txn.display_name || txn.raw_description}
                          </span>
                          {txn.category_name && (
                            <Badge variant="secondary" className="text-xs">{txn.category_icon} {txn.category_name}</Badge>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-500 mt-0.5">
                          <span>{formatDate(txn.date)}</span>
                          <span>{formatCurrency(txn.amount)}</span>
                          {txn.account_name && <span>{txn.account_name}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 text-xs shrink-0"
                        onClick={() => deleteDuplicate(txn.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Name</label>
              <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="e.g. tax-deductible" />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Color</label>
              <Input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="h-10 w-20 p-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancel</Button>
              <Button onClick={createTag} disabled={!newTagName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
