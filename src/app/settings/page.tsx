"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { formatDate } from "@/lib/utils"
import { Plus, Trash2, Edit2, Building2, Tag, RefreshCw, Tags } from "lucide-react"
import { toast } from "sonner"

interface Account {
  id: string; name: string; type: string; institution: string; currency: string; created_at: string;
}

interface Alias {
  id: string; raw_pattern: string; display_name: string; category_id: string | null;
  category_name: string | null; match_count: number;
}

interface Category {
  id: string; name: string; icon: string;
}

interface TagItem {
  id: string; name: string; color: string; usage_count: number;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [aliases, setAliases] = useState<Alias[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [showAliasDialog, setShowAliasDialog] = useState(false)
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState({ name: "", type: "checking", institution: "", currency: "USD" })
  const [aliasForm, setAliasForm] = useState({ raw_pattern: "", display_name: "", category_id: "" })
  const [applyRetroactively, setApplyRetroactively] = useState(true)
  const [reapplying, setReapplying] = useState(false)
  const [tagsList, setTagsList] = useState<TagItem[]>([])
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [tagForm, setTagForm] = useState({ id: "", name: "", color: "#6B7280" })

  const fetchData = () => {
    fetch("/api/accounts").then(r => r.json()).then(d => setAccounts(d.accounts || []))
    fetch("/api/aliases").then(r => r.json()).then(d => setAliases(d.aliases || []))
    fetch("/api/categories").then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch("/api/tags").then(r => r.json()).then(d => setTagsList(d.tags || []))
  }

  useEffect(() => { fetchData() }, [])

  const createAccount = async () => {
    if (!accountForm.name) return
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountForm),
    })
    setShowAccountDialog(false)
    setAccountForm({ name: "", type: "checking", institution: "", currency: "USD" })
    fetchData()
    toast.success("Account created")
  }

  const saveAlias = async () => {
    if (!aliasForm.raw_pattern || !aliasForm.display_name) return
    const method = editingAliasId ? "PUT" : "POST"
    const body = editingAliasId
      ? { id: editingAliasId, ...aliasForm }
      : { ...aliasForm, apply_retroactively: applyRetroactively }
    const res = await fetch("/api/aliases", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setShowAliasDialog(false)
    setEditingAliasId(null)
    setAliasForm({ raw_pattern: "", display_name: "", category_id: "" })
    setApplyRetroactively(true)
    fetchData()
    if (data.retroactive?.matched > 0) {
      toast.success(`Alias saved — matched ${data.retroactive.matched} existing transaction${data.retroactive.matched > 1 ? 's' : ''}`)
    } else {
      toast.success("Alias saved")
    }
  }

  const reapplyAllAliases = async () => {
    setReapplying(true)
    try {
      const res = await fetch("/api/aliases/reapply", { method: "POST" })
      const data = await res.json()
      toast.success(`Re-applied aliases: ${data.matched} of ${data.total} unmatched transactions updated`)
      fetchData()
    } catch {
      toast.error("Failed to re-apply aliases")
    } finally {
      setReapplying(false)
    }
  }

  const editAlias = (alias: Alias) => {
    setEditingAliasId(alias.id)
    setAliasForm({
      raw_pattern: alias.raw_pattern,
      display_name: alias.display_name,
      category_id: alias.category_id || "",
    })
    setShowAliasDialog(true)
  }

  const openNewAlias = () => {
    setEditingAliasId(null)
    setAliasForm({ raw_pattern: "", display_name: "", category_id: "" })
    setShowAliasDialog(true)
  }

  const deleteAlias = async (id: string) => {
    await fetch("/api/aliases", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchData()
    toast.success("Alias deleted")
  }

  const saveTag = async () => {
    if (!tagForm.name.trim()) return
    const method = tagForm.id ? "PUT" : "POST"
    await fetch("/api/tags", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tagForm),
    })
    setShowTagDialog(false)
    setTagForm({ id: "", name: "", color: "#6B7280" })
    fetchData()
    toast.success("Tag saved")
  }

  const deleteTag = async (id: string) => {
    await fetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchData()
    toast.success("Tag deleted")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-500 text-sm">Manage accounts, aliases, and tags</p>
      </div>

      {/* Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Accounts</CardTitle>
            <CardDescription>Your bank and financial accounts</CardDescription>
          </div>
          <Button onClick={() => setShowAccountDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Account
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No accounts yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                  <div>
                    <p className="font-medium text-zinc-200">{acc.name}</p>
                    <p className="text-xs text-zinc-500">{acc.institution || "No institution"} &middot; {acc.currency}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">{acc.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merchant Aliases */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Merchant Aliases</CardTitle>
            <CardDescription>Map raw bank descriptions to friendly names</CardDescription>
          </div>
          <div className="flex gap-2">
            {aliases.length > 0 && (
              <Button onClick={reapplyAllAliases} variant="outline" size="sm" disabled={reapplying}>
                {reapplying ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Re-apply All
              </Button>
            )}
            <Button onClick={openNewAlias} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Alias
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aliases.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No aliases yet. Aliases auto-assign names and categories on import.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aliases.map(alias => (
                <div key={alias.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-200">{alias.display_name}</p>
                      {alias.category_name && <Badge variant="secondary" className="text-xs">{alias.category_name}</Badge>}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">Pattern: {alias.raw_pattern}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-zinc-600">{alias.match_count} matches</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editAlias(alias)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteAlias(alias.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Tags</CardTitle>
            <CardDescription>Flexible labels for transactions</CardDescription>
          </div>
          <Button onClick={() => { setTagForm({ id: "", name: "", color: "#6B7280" }); setShowTagDialog(true) }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Tag
          </Button>
        </CardHeader>
        <CardContent>
          {tagsList.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No tags yet. Create tags to label transactions.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagsList.map(tag => (
                <div key={tag.id} className="flex items-center gap-1.5 py-1.5 px-3 rounded-full border border-zinc-700 group hover:border-zinc-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm text-zinc-200">{tag.name}</span>
                  <span className="text-xs text-zinc-600">{tag.usage_count}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setTagForm({ id: tag.id, name: tag.name, color: tag.color }); setShowTagDialog(true) }}
                  >
                    <Edit2 className="h-2.5 w-2.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteTag(tag.id)}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Account Name *</label>
              <Input value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="e.g. Chase Checking" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Type</label>
                <Select value={accountForm.type} onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit">Credit Card</option>
                  <option value="investment">Investment</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Currency</label>
                <Select value={accountForm.currency} onChange={e => setAccountForm({ ...accountForm, currency: e.target.value })}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Institution</label>
              <Input value={accountForm.institution} onChange={e => setAccountForm({ ...accountForm, institution: e.target.value })} placeholder="e.g. Chase Bank" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAccountDialog(false)}>Cancel</Button>
              <Button onClick={createAccount}>Create Account</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alias Dialog */}
      <Dialog open={showAliasDialog} onOpenChange={(open) => { setShowAliasDialog(open); if (!open) setEditingAliasId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAliasId ? "Edit" : "Add"} Merchant Alias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Raw Pattern *</label>
              <Input value={aliasForm.raw_pattern} onChange={e => setAliasForm({ ...aliasForm, raw_pattern: e.target.value })} placeholder="e.g. STARBKS" />
              <p className="text-xs text-zinc-600 mt-1">Uses contains matching — e.g. &quot;STARBKS&quot; matches any description containing that text</p>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Display Name *</label>
              <Input value={aliasForm.display_name} onChange={e => setAliasForm({ ...aliasForm, display_name: e.target.value })} placeholder="e.g. Starbucks" />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Auto-assign Category</label>
              <Select value={aliasForm.category_id} onChange={e => setAliasForm({ ...aliasForm, category_id: e.target.value })}>
                <option value="">None</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </Select>
            </div>
            {!editingAliasId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={applyRetroactively} onCheckedChange={(v) => setApplyRetroactively(!!v)} />
                <span className="text-sm text-zinc-300">Apply to existing transactions</span>
              </label>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAliasDialog(false)}>Cancel</Button>
              <Button onClick={saveAlias}>{editingAliasId ? "Save" : "Create"} Alias</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tagForm.id ? "Edit" : "New"} Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Name *</label>
              <Input value={tagForm.name} onChange={e => setTagForm({ ...tagForm, name: e.target.value })} placeholder="e.g. tax-deductible" />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Color</label>
              <Input type="color" value={tagForm.color} onChange={e => setTagForm({ ...tagForm, color: e.target.value })} className="h-10 w-20 p-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancel</Button>
              <Button onClick={saveTag} disabled={!tagForm.name.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
