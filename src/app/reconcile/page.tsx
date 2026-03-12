"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency, formatDate } from "@/lib/utils"
import { RECONCILIATION_TOLERANCE } from "@/lib/constants"
import { CheckSquare, Lock, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface Account { id: string; name: string }
interface Transaction {
  id: string; date: string; amount: number; raw_description: string; display_name: string;
  is_reconciled: number; category_icon: string; category_name: string;
}
interface Session {
  id: string; account_id: string; account_name: string; statement_date: string;
  statement_balance: number; status: string; created_at: string;
}

export default function ReconcilePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [accountId, setAccountId] = useState("")
  const [statementDate, setStatementDate] = useState("")
  const [statementBalance, setStatementBalance] = useState("")
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cleared, setCleared] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/accounts").then(r => r.json()).then(d => setAccounts(d.accounts || []))
    fetch("/api/reconciliation").then(r => r.json()).then(d => setSessions(d.sessions || []))
  }, [])

  const startSession = async () => {
    if (!accountId || !statementDate || !statementBalance) return
    const res = await fetch("/api/reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountId, statement_date: statementDate, statement_balance: parseFloat(statementBalance) }),
    })
    const data = await res.json()
    setActiveSession(data.session)
    loadSessionTransactions(data.session.id)
    toast.success("Reconciliation session started")
  }

  const loadSessionTransactions = async (sessionId: string) => {
    const res = await fetch(`/api/reconciliation/${sessionId}`)
    const data = await res.json()
    setTransactions(data.transactions || [])
    setActiveSession(data.session)
    setCleared(new Set(data.transactions?.filter((t: Transaction) => t.is_reconciled).map((t: Transaction) => t.id) || []))
  }

  const toggleCleared = (id: string) => {
    setCleared(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearAll = () => {
    setCleared(new Set(transactions.map(t => t.id)))
  }

  const finishReconciliation = async () => {
    if (!activeSession) return
    await fetch(`/api/reconciliation/${activeSession.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", clearedIds: Array.from(cleared) }),
    })
    setActiveSession(null)
    setTransactions([])
    setCleared(new Set())
    fetch("/api/reconciliation").then(r => r.json()).then(d => setSessions(d.sessions || []))
    toast.success("Reconciliation completed!")
  }

  const clearedBalance = transactions
    .filter(t => cleared.has(t.id))
    .reduce((s, t) => s + t.amount, 0)
  const difference = activeSession ? activeSession.statement_balance - clearedBalance : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reconciliation</h1>
        <p className="text-zinc-500 text-sm">Match your records with bank statements</p>
      </div>

      {!activeSession ? (
        <>
          {/* Start new session */}
          <Card>
            <CardHeader>
              <CardTitle>New Reconciliation</CardTitle>
              <CardDescription>Enter your statement details to begin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Account</label>
                  <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Statement Date</label>
                  <Input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Statement Balance</label>
                  <Input type="number" step="0.01" value={statementBalance} onChange={e => setStatementBalance(e.target.value)} placeholder="1234.56" />
                </div>
              </div>
              <Button onClick={startSession} disabled={!accountId || !statementDate || !statementBalance}>
                <CheckSquare className="h-4 w-4 mr-1" /> Start Reconciliation
              </Button>
            </CardContent>
          </Card>

          {/* Past sessions */}
          {sessions.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Past Sessions</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/30">
                      <div>
                        <span className="text-zinc-200 font-medium">{s.account_name}</span>
                        <span className="text-zinc-500 text-sm ml-2">{formatDate(s.statement_date)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{formatCurrency(s.statement_balance)}</span>
                        <Badge variant={s.status === "completed" ? "success" : "warning"}>
                          {s.status === "completed" ? <><Lock className="h-3 w-3 mr-1" /> Completed</> : "In Progress"}
                        </Badge>
                        {s.status === "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => loadSessionTransactions(s.id)}>
                            Resume
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Active session */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400">Statement Balance</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(activeSession.statement_balance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400">Cleared Balance</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(clearedBalance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400">Difference</p>
                <p className={`text-2xl font-bold mt-1 ${Math.abs(difference) < RECONCILIATION_TOLERANCE ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(difference)}
                </p>
                {Math.abs(difference) < RECONCILIATION_TOLERANCE && (
                  <Badge variant="success" className="mt-1">Balanced!</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Transactions</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAll}>Clear All</Button>
                <Button variant="outline" size="sm" onClick={() => { setActiveSession(null); setTransactions([]) }}>Cancel</Button>
                <Button size="sm" onClick={finishReconciliation} disabled={Math.abs(difference) >= RECONCILIATION_TOLERANCE} variant="success">
                  <Lock className="h-4 w-4 mr-1" /> Finish
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No unreconciled transactions found for this account</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {transactions.map(txn => (
                    <div
                      key={txn.id}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                        cleared.has(txn.id) ? "bg-emerald-600/5 border border-emerald-600/20" : "hover:bg-zinc-800/30"
                      }`}
                      onClick={() => !txn.is_reconciled && toggleCleared(txn.id)}
                    >
                      <Checkbox checked={cleared.has(txn.id)} disabled={!!txn.is_reconciled} />
                      <span className="text-sm text-zinc-500 w-24">{formatDate(txn.date)}</span>
                      <span className="text-sm text-zinc-200 flex-1 truncate">
                        {txn.display_name || txn.raw_description}
                      </span>
                      <span className={`text-sm font-medium ${txn.amount >= 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {formatCurrency(txn.amount)}
                      </span>
                      {txn.is_reconciled ? <Lock className="h-3 w-3 text-zinc-600" /> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
