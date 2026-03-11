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
import { Plus, Trash2, Edit2, Building2, Tag, RefreshCw, Tags, Zap, Play, Pause, Sparkles, Check, X, Loader2, Download, Upload, HardDrive, ShieldCheck } from "lucide-react"
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

interface RuleCondition {
  field: 'description' | 'amount' | 'account'
  operator: string
  value: string
  value2?: string
}

interface RuleAction {
  type: 'set_category' | 'set_display_name' | 'add_tag'
  value: string
}

interface Rule {
  id: string; name: string; priority: number; conditions: RuleCondition[]
  actions: RuleAction[]; is_active: number; match_count: number
  category_name?: string; category_icon?: string
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [aliases, setAliases] = useState<Alias[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [showAliasDialog, setShowAliasDialog] = useState(false)
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState({ name: "", type: "checking", institution: "", currency: "USD" })
  const [aliasForm, setAliasForm] = useState({ raw_pattern: "", display_name: "", category_id: "" })
  const [applyRetroactively, setApplyRetroactively] = useState(true)
  const [reapplying, setReapplying] = useState(false)
  const [showAISuggest, setShowAISuggest] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<{
    raw_description: string; raw_pattern: string; display_name: string
    category_id: string; category_name: string; accepted?: boolean
  }[]>([])
  const [tagsList, setTagsList] = useState<TagItem[]>([])
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [tagForm, setTagForm] = useState({ id: "", name: "", color: "#6B7280" })
  const [rules, setRules] = useState<Rule[]>([])
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleName, setRuleName] = useState("")
  const [rulePriority, setRulePriority] = useState("0")
  const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([{ field: 'description', operator: 'contains', value: '' }])
  const [ruleActions, setRuleActions] = useState<RuleAction[]>([{ type: 'set_category', value: '' }])
  const [ruleApplyRetro, setRuleApplyRetro] = useState(true)
  const [applyingRules, setApplyingRules] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const fetchData = () => {
    fetch("/api/accounts").then(r => r.json()).then(d => setAccounts(d.accounts || []))
    fetch("/api/aliases").then(r => r.json()).then(d => setAliases(d.aliases || []))
    fetch("/api/categories").then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch("/api/tags").then(r => r.json()).then(d => setTagsList(d.tags || []))
    fetch("/api/rules").then(r => r.json()).then(d => setRules(d.rules || []))
  }

  useEffect(() => { fetchData() }, [])

  const saveAccount = async () => {
    if (!accountForm.name) return
    const method = editingAccountId ? "PUT" : "POST"
    const body = editingAccountId ? { id: editingAccountId, ...accountForm } : accountForm
    await fetch("/api/accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setShowAccountDialog(false)
    setEditingAccountId(null)
    setAccountForm({ name: "", type: "checking", institution: "", currency: "USD" })
    fetchData()
    toast.success(editingAccountId ? "Account updated" : "Account created")
  }

  const editAccount = (acc: Account) => {
    setEditingAccountId(acc.id)
    setAccountForm({ name: acc.name, type: acc.type, institution: acc.institution, currency: acc.currency })
    setShowAccountDialog(true)
  }

  const openNewAccount = () => {
    setEditingAccountId(null)
    setAccountForm({ name: "", type: "checking", institution: "", currency: "USD" })
    setShowAccountDialog(true)
  }

  const confirmDeleteAccount = async () => {
    if (!deletingAccount) return
    const res = await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deletingAccount.id }),
    })
    const data = await res.json()
    setDeletingAccount(null)
    if (!res.ok) {
      toast.error(data.error || "Failed to delete account")
      return
    }
    fetchData()
    toast.success("Account deleted")
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

  const runAISuggest = async () => {
    setShowAISuggest(true)
    setAiLoading(true)
    setAiSuggestions([])
    try {
      const res = await fetch("/api/ai/suggest-aliases", { method: "POST" })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        setShowAISuggest(false)
        return
      }
      if (data.message) {
        toast.info(data.message)
        setShowAISuggest(false)
        return
      }
      setAiSuggestions((data.suggestions || []).map((s: any) => ({ ...s, accepted: true })))
    } catch {
      toast.error("Failed to get AI suggestions")
      setShowAISuggest(false)
    } finally {
      setAiLoading(false)
    }
  }

  const acceptAISuggestions = async () => {
    const accepted = aiSuggestions.filter(s => s.accepted)
    if (accepted.length === 0) {
      setShowAISuggest(false)
      return
    }
    let created = 0
    for (const s of accepted) {
      await fetch("/api/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_pattern: s.raw_pattern,
          display_name: s.display_name,
          category_id: s.category_id || null,
          apply_retroactively: true,
        }),
      })
      created++
    }
    setShowAISuggest(false)
    fetchData()
    toast.success(`Created ${created} alias${created > 1 ? 'es' : ''} and applied to existing transactions`)
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

  const openNewRule = () => {
    setEditingRuleId(null)
    setRuleName("")
    setRulePriority("0")
    setRuleConditions([{ field: 'description', operator: 'contains', value: '' }])
    setRuleActions([{ type: 'set_category', value: '' }])
    setRuleApplyRetro(true)
    setShowRuleDialog(true)
  }

  const editRule = (rule: Rule) => {
    setEditingRuleId(rule.id)
    setRuleName(rule.name)
    setRulePriority(String(rule.priority))
    setRuleConditions(rule.conditions)
    setRuleActions(rule.actions)
    setShowRuleDialog(true)
  }

  const saveRule = async () => {
    if (!ruleName || ruleConditions.some(c => !c.value) || ruleActions.some(a => !a.value)) return
    const method = editingRuleId ? "PUT" : "POST"
    const body: any = {
      name: ruleName,
      priority: parseInt(rulePriority) || 0,
      conditions: ruleConditions,
      actions: ruleActions,
    }
    if (editingRuleId) body.id = editingRuleId
    else body.apply_retroactively = ruleApplyRetro

    const res = await fetch("/api/rules", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setShowRuleDialog(false)
    setEditingRuleId(null)
    fetchData()
    if (data.retroactive?.matched > 0) {
      toast.success(`Rule saved — matched ${data.retroactive.matched} transaction${data.retroactive.matched > 1 ? 's' : ''}`)
    } else {
      toast.success("Rule saved")
    }
  }

  const deleteRule = async (id: string) => {
    await fetch("/api/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchData()
    toast.success("Rule deleted")
  }

  const toggleRule = async (rule: Rule) => {
    await fetch("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: rule.is_active ? 0 : 1 }),
    })
    fetchData()
  }

  const applyAllRules = async () => {
    setApplyingRules(true)
    try {
      const res = await fetch("/api/rules/apply", { method: "POST" })
      const data = await res.json()
      toast.success(`Applied rules: ${data.matched} of ${data.total} transactions matched`)
      fetchData()
    } catch {
      toast.error("Failed to apply rules")
    } finally {
      setApplyingRules(false)
    }
  }

  const downloadBackup = async () => {
    try {
      const res = await fetch("/api/backup")
      if (!res.ok) throw new Error("Backup failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : "cashflow-backup.db"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Backup downloaded")
    } catch {
      toast.error("Failed to create backup")
    }
  }

  const restoreBackup = async (file: File) => {
    setRestoring(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/backup", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to restore backup")
        return
      }
      toast.success("Database restored. Refreshing...")
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error("Failed to restore backup")
    } finally {
      setRestoring(false)
    }
  }

  const optimizeDatabase = async () => {
    setOptimizing(true)
    try {
      const res = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Database optimized")
    } catch {
      toast.error("Failed to optimize database")
    } finally {
      setOptimizing(false)
    }
  }

  const checkDatabaseHealth = async () => {
    setCheckingHealth(true)
    try {
      const res = await fetch("/api/database")
      const data = await res.json()
      setDbHealthy(data.healthy)
      if (data.healthy) {
        toast.success("Database integrity check passed")
      } else {
        toast.error("Database integrity issues detected")
      }
    } catch {
      toast.error("Failed to check database health")
    } finally {
      setCheckingHealth(false)
    }
  }

  const operatorLabels: Record<string, string> = {
    contains: 'contains', starts_with: 'starts with', ends_with: 'ends with',
    equals: 'equals', regex: 'matches regex',
    gt: '>', lt: '<', gte: '>=', lte: '<=', between: 'between',
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
          <Button onClick={openNewAccount} size="sm">
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{acc.type}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editAccount(acc)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => setDeletingAccount(acc)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
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
            <Button onClick={runAISuggest} variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-1" /> AI Suggest
            </Button>
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

      {/* Categorization Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Categorization Rules</CardTitle>
            <CardDescription>Auto-categorize transactions based on conditions</CardDescription>
          </div>
          <div className="flex gap-2">
            {rules.length > 0 && (
              <Button onClick={applyAllRules} variant="outline" size="sm" disabled={applyingRules}>
                {applyingRules ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Apply All
              </Button>
            )}
            <Button onClick={openNewRule} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No rules yet. Rules run automatically on import and can set categories, display names, or tags.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className={`flex items-center justify-between py-3 px-4 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 ${!rule.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-200">{rule.name}</p>
                      <Badge variant="secondary" className="text-xs">Priority {rule.priority}</Badge>
                      {!rule.is_active && <Badge variant="secondary" className="text-xs text-zinc-500">Disabled</Badge>}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {rule.conditions.map((c, i) => (
                        <span key={i}>
                          {i > 0 && ' AND '}
                          {c.field} {operatorLabels[c.operator]} &quot;{c.value}&quot;
                          {c.operator === 'between' && ` and "${c.value2}"`}
                        </span>
                      ))}
                      {' → '}
                      {rule.actions.map((a, i) => (
                        <span key={i}>
                          {i > 0 && ', '}
                          {a.type === 'set_category' && `category: ${rule.category_name || a.value}`}
                          {a.type === 'set_display_name' && `name: "${a.value}"`}
                          {a.type === 'add_tag' && `tag: ${a.value}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs text-zinc-600">{rule.match_count} matches</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleRule(rule)}>
                      {rule.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editRule(rule)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Database Management</CardTitle>
            <CardDescription>Backup, restore, and optimize your database</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-zinc-800/30 space-y-2">
              <h3 className="text-sm font-medium text-zinc-200">Backup & Restore</h3>
              <p className="text-xs text-zinc-500">Download a copy of your database or restore from a previous backup.</p>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={downloadBackup}>
                  <Download className="h-4 w-4 mr-1" /> Export Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoring}
                  onClick={() => {
                    const input = document.createElement("input")
                    input.type = "file"
                    input.accept = ".db"
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) restoreBackup(file)
                    }
                    input.click()
                  }}
                >
                  {restoring ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Restore Backup
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-zinc-800/30 space-y-2">
              <h3 className="text-sm font-medium text-zinc-200">Maintenance</h3>
              <p className="text-xs text-zinc-500">Optimize reclaims unused space. Health check verifies data integrity.</p>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={optimizeDatabase} disabled={optimizing}>
                  {optimizing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Optimize
                </Button>
                <Button variant="outline" size="sm" onClick={checkDatabaseHealth} disabled={checkingHealth}>
                  {checkingHealth ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                  Health Check
                  {dbHealthy !== null && (
                    <Badge variant={dbHealthy ? "success" : "destructive"} className="ml-2 text-xs">
                      {dbHealthy ? "OK" : "Issues"}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={(open) => { setShowAccountDialog(open); if (!open) setEditingAccountId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccountId ? "Edit" : "Add"} Account</DialogTitle>
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
              <Button onClick={saveAccount}>{editingAccountId ? "Save" : "Create"} Account</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirm */}
      <Dialog open={!!deletingAccount} onOpenChange={(open) => { if (!open) setDeletingAccount(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-300">
            Are you sure you want to delete <span className="font-semibold text-zinc-100">{deletingAccount?.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeletingAccount(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteAccount}>Delete Account</Button>
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

      {/* AI Alias Suggestions Dialog */}
      <Dialog open={showAISuggest} onOpenChange={setShowAISuggest}>
        <DialogContent className="max-w-2xl flex flex-col !max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> AI-Suggested Aliases
            </DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <div className="py-12 flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Analyzing your transactions...</p>
            </div>
          ) : aiSuggestions.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">No suggestions generated.</div>
          ) : (
            <>
              <p className="text-sm text-zinc-400 shrink-0">
                Review suggestions below. Toggle off any you don&apos;t want, then click Accept.
              </p>
              <div className="overflow-y-auto space-y-2 min-h-0 flex-1">
                {aiSuggestions.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 py-3 px-4 rounded-lg border transition-colors ${
                      s.accepted ? 'bg-zinc-800/40 border-zinc-700/50' : 'bg-zinc-900/30 border-zinc-800/30 opacity-50'
                    }`}
                  >
                    <button
                      className={`mt-1 shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                        s.accepted ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'
                      }`}
                      onClick={() => {
                        const updated = [...aiSuggestions]
                        updated[i] = { ...s, accepted: !s.accepted }
                        setAiSuggestions(updated)
                      }}
                    >
                      {s.accepted && <Check className="h-3 w-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-200">{s.display_name}</span>
                        {s.category_name && (
                          <Badge variant="secondary" className="text-xs">{s.category_name}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        Pattern: <span className="text-zinc-400">&quot;{s.raw_pattern}&quot;</span>
                        <span className="mx-1.5">&middot;</span>
                        From: <span className="text-zinc-400">&quot;{s.raw_description}&quot;</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between shrink-0 border-t border-zinc-800 pt-3">
                <p className="text-xs text-zinc-500">
                  {aiSuggestions.filter(s => s.accepted).length} of {aiSuggestions.length} selected
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAISuggest(false)}>Cancel</Button>
                  <Button onClick={acceptAISuggestions} disabled={aiSuggestions.filter(s => s.accepted).length === 0}>
                    <Check className="h-4 w-4 mr-1" /> Accept & Create
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={(open) => { setShowRuleDialog(open); if (!open) setEditingRuleId(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRuleId ? "Edit" : "New"} Categorization Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Rule Name *</label>
                <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Starbucks → Food" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Priority</label>
                <Input type="number" value={rulePriority} onChange={e => setRulePriority(e.target.value)} placeholder="0" />
                <p className="text-xs text-zinc-600 mt-0.5">Higher = runs first</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Conditions (all must match)</label>
              <div className="space-y-2">
                {ruleConditions.map((cond, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Select
                      value={cond.field}
                      onChange={e => {
                        const updated = [...ruleConditions]
                        updated[i] = { ...cond, field: e.target.value as any, operator: e.target.value === 'amount' ? 'gt' : 'contains', value: '' }
                        setRuleConditions(updated)
                      }}
                      className="w-32"
                    >
                      <option value="description">Description</option>
                      <option value="amount">Amount</option>
                      <option value="account">Account</option>
                    </Select>
                    <Select
                      value={cond.operator}
                      onChange={e => {
                        const updated = [...ruleConditions]
                        updated[i] = { ...cond, operator: e.target.value }
                        setRuleConditions(updated)
                      }}
                      className="w-32"
                    >
                      {cond.field === 'amount' ? (
                        <>
                          <option value="gt">&gt;</option>
                          <option value="lt">&lt;</option>
                          <option value="gte">&gt;=</option>
                          <option value="lte">&lt;=</option>
                          <option value="equals">=</option>
                          <option value="between">between</option>
                        </>
                      ) : cond.field === 'account' ? (
                        <option value="equals">is</option>
                      ) : (
                        <>
                          <option value="contains">contains</option>
                          <option value="starts_with">starts with</option>
                          <option value="ends_with">ends with</option>
                          <option value="equals">equals</option>
                          <option value="regex">regex</option>
                        </>
                      )}
                    </Select>
                    <Input
                      value={cond.value}
                      onChange={e => {
                        const updated = [...ruleConditions]
                        updated[i] = { ...cond, value: e.target.value }
                        setRuleConditions(updated)
                      }}
                      placeholder={cond.field === 'amount' ? '0.00' : 'value'}
                      className="flex-1"
                    />
                    {cond.operator === 'between' && (
                      <Input
                        value={cond.value2 || ''}
                        onChange={e => {
                          const updated = [...ruleConditions]
                          updated[i] = { ...cond, value2: e.target.value }
                          setRuleConditions(updated)
                        }}
                        placeholder="max"
                        className="w-24"
                      />
                    )}
                    {ruleConditions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-red-400"
                        onClick={() => setRuleConditions(ruleConditions.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setRuleConditions([...ruleConditions, { field: 'description', operator: 'contains', value: '' }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Condition
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Actions</label>
              <div className="space-y-2">
                {ruleActions.map((action, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Select
                      value={action.type}
                      onChange={e => {
                        const updated = [...ruleActions]
                        updated[i] = { type: e.target.value as any, value: '' }
                        setRuleActions(updated)
                      }}
                      className="w-44"
                    >
                      <option value="set_category">Set Category</option>
                      <option value="set_display_name">Set Display Name</option>
                      <option value="add_tag">Add Tag</option>
                    </Select>
                    {action.type === 'set_category' ? (
                      <Select
                        value={action.value}
                        onChange={e => {
                          const updated = [...ruleActions]
                          updated[i] = { ...action, value: e.target.value }
                          setRuleActions(updated)
                        }}
                        className="flex-1"
                      >
                        <option value="">Select category...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </Select>
                    ) : action.type === 'add_tag' ? (
                      <Select
                        value={action.value}
                        onChange={e => {
                          const updated = [...ruleActions]
                          updated[i] = { ...action, value: e.target.value }
                          setRuleActions(updated)
                        }}
                        className="flex-1"
                      >
                        <option value="">Select tag...</option>
                        {tagsList.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={action.value}
                        onChange={e => {
                          const updated = [...ruleActions]
                          updated[i] = { ...action, value: e.target.value }
                          setRuleActions(updated)
                        }}
                        placeholder="Display name"
                        className="flex-1"
                      />
                    )}
                    {ruleActions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-red-400"
                        onClick={() => setRuleActions(ruleActions.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setRuleActions([...ruleActions, { type: 'set_category', value: '' }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Action
                </Button>
              </div>
            </div>

            {!editingRuleId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={ruleApplyRetro} onCheckedChange={(v) => setRuleApplyRetro(!!v)} />
                <span className="text-sm text-zinc-300">Apply to all existing transactions</span>
              </label>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancel</Button>
              <Button onClick={saveRule}>{editingRuleId ? "Save" : "Create"} Rule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
