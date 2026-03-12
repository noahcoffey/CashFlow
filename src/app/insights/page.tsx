"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { Sparkles, TrendingUp, Target, AlertTriangle, MessageSquare, RefreshCw, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface AIResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  cached_at: string | null
}

function useAI<T>(endpoint: string) {
  const [result, setResult] = useState<AIResult<T>>({
    data: null, error: null, loading: false, cached_at: null,
  })

  const run = async (refresh = false) => {
    setResult(prev => ({ ...prev, loading: true, error: null }))
    try {
      const url = refresh ? `${endpoint}?refresh=true` : endpoint
      const res = await fetch(url)
      const data = await res.json()
      if (data.error === "CLAUDE_NOT_FOUND") {
        setResult({ data: null, error: "CLAUDE_NOT_FOUND", loading: false, cached_at: null })
        return
      }
      if (data.error) {
        setResult({ data: null, error: data.error, loading: false, cached_at: null })
        return
      }
      setResult({ data: data.data || data, error: null, loading: false, cached_at: data.cached_at || null })
    } catch (e: unknown) {
      setResult({ data: null, error: e instanceof Error ? e.message : 'An unexpected error occurred', loading: false, cached_at: null })
    }
  }

  return { ...result, run }
}

interface ForecastItem { category: string; projected_amount: number; confidence: string; reasoning: string }
interface BudgetSuggestion { category: string; recommended_amount: number; current_budget: number; reasoning: string }
interface AnomalyItem { category: string; average_amount: number; current_amount: number; status: string; reasoning: string }

export default function InsightsPage() {
  const forecast = useAI<ForecastItem[]>("/api/ai/forecast")
  const budgetSuggestions = useAI<BudgetSuggestion[]>("/api/ai/budget-suggestions")
  const anomalies = useAI<AnomalyItem[]>("/api/ai/anomalies")
  const [query, setQuery] = useState("")
  const [queryResult, setQueryResult] = useState<string | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  const askQuestion = async () => {
    if (!query.trim()) return
    setQueryLoading(true)
    setQueryError(null)
    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      })
      const data = await res.json()
      if (data.error === "CLAUDE_NOT_FOUND") {
        setQueryError("CLAUDE_NOT_FOUND")
      } else if (data.error) {
        setQueryError(data.error)
      } else {
        setQueryResult(data.answer)
      }
    } catch (e: unknown) {
      setQueryError(e instanceof Error ? e.message : 'An unexpected error occurred')
    } finally {
      setQueryLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-400" /> AI Insights
        </h1>
        <p className="text-zinc-500 text-sm">Powered by Claude Code CLI</p>
      </div>

      {/* Claude Not Found Banner */}
      {(forecast.error === "CLAUDE_NOT_FOUND" || budgetSuggestions.error === "CLAUDE_NOT_FOUND" || anomalies.error === "CLAUDE_NOT_FOUND" || queryError === "CLAUDE_NOT_FOUND") && (
        <Card className="border-amber-600/30 bg-amber-600/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-200 font-medium">Claude Code CLI not found</p>
              <p className="text-amber-400/70 text-sm mt-1">
                Install it with: <code className="bg-amber-600/20 px-1.5 py-0.5 rounded text-amber-300">npm install -g @anthropic-ai/claude-code</code>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Forecast */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                <CardTitle className="text-base">Spending Forecast</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                {forecast.cached_at && (
                  <span className="text-xs text-zinc-600">Cached</span>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => forecast.run(true)} disabled={forecast.loading}>
                  <RefreshCw className={`h-3 w-3 ${forecast.loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <CardDescription>Projected spending for next month</CardDescription>
          </CardHeader>
          <CardContent>
            {!forecast.data && !forecast.loading && !forecast.error ? (
              <Button onClick={() => forecast.run()} className="w-full">Run Analysis</Button>
            ) : forecast.loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : forecast.error && forecast.error !== "CLAUDE_NOT_FOUND" ? (
              <p className="text-red-400 text-sm">{forecast.error}</p>
            ) : forecast.data ? (
              <div className="space-y-3">
                {(Array.isArray(forecast.data) ? forecast.data : []).map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-zinc-800/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200">{item.category}</span>
                      <span className="text-blue-400 font-medium">{formatCurrency(item.projected_amount)}</span>
                    </div>
                    <p className="text-xs text-zinc-500">{item.reasoning}</p>
                    <Badge variant="secondary" className="text-xs">{item.confidence} confidence</Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Budget Recommendations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-base">Budget Recommendations</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => budgetSuggestions.run(true)} disabled={budgetSuggestions.loading}>
                <RefreshCw className={`h-3 w-3 ${budgetSuggestions.loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CardDescription>AI-suggested budget amounts</CardDescription>
          </CardHeader>
          <CardContent>
            {!budgetSuggestions.data && !budgetSuggestions.loading && !budgetSuggestions.error ? (
              <Button onClick={() => budgetSuggestions.run()} className="w-full">Run Analysis</Button>
            ) : budgetSuggestions.loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : budgetSuggestions.error && budgetSuggestions.error !== "CLAUDE_NOT_FOUND" ? (
              <p className="text-red-400 text-sm">{budgetSuggestions.error}</p>
            ) : budgetSuggestions.data ? (
              <div className="space-y-3">
                {(Array.isArray(budgetSuggestions.data) ? budgetSuggestions.data : []).map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-zinc-800/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200">{item.category}</span>
                      <div className="text-right">
                        <span className="text-emerald-400 font-medium">{formatCurrency(item.recommended_amount)}</span>
                        {item.current_budget > 0 && (
                          <span className="text-zinc-600 text-xs ml-1">(was {formatCurrency(item.current_budget)})</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">{item.reasoning}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Anomaly Detection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <CardTitle className="text-base">Anomaly Detection</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => anomalies.run(true)} disabled={anomalies.loading}>
                <RefreshCw className={`h-3 w-3 ${anomalies.loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CardDescription>Unusual spending patterns</CardDescription>
          </CardHeader>
          <CardContent>
            {!anomalies.data && !anomalies.loading && !anomalies.error ? (
              <Button onClick={() => anomalies.run()} className="w-full">Run Analysis</Button>
            ) : anomalies.loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : anomalies.error && anomalies.error !== "CLAUDE_NOT_FOUND" ? (
              <p className="text-red-400 text-sm">{anomalies.error}</p>
            ) : anomalies.data ? (
              <div className="space-y-3">
                {(Array.isArray(anomalies.data) ? anomalies.data : []).filter(a => a.status !== "normal").map((item, i) => (
                  <div key={i} className={`p-3 rounded-lg space-y-1 ${
                    item.status === "high" ? "bg-red-600/10 border border-red-600/20" : "bg-blue-600/10 border border-blue-600/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200">{item.category}</span>
                      <Badge variant={item.status === "high" ? "destructive" : "default"}>
                        {item.status === "high" ? "Unusually High" : "Unusually Low"}
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <span>Average: {formatCurrency(item.average_amount)}</span>
                      <span>Current: {formatCurrency(item.current_amount)}</span>
                    </div>
                    <p className="text-xs text-zinc-500">{item.reasoning}</p>
                  </div>
                ))}
                {(Array.isArray(anomalies.data) ? anomalies.data : []).filter(a => a.status !== "normal").length === 0 && (
                  <p className="text-zinc-500 text-center py-4">No anomalies detected. Spending looks normal!</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Natural Language Query */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-base">Ask About Your Finances</CardTitle>
            </div>
            <CardDescription>Ask any question about your spending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. How much did I spend on food last month?"
                onKeyDown={e => e.key === "Enter" && askQuestion()}
              />
              <Button onClick={askQuestion} disabled={queryLoading || !query.trim()}>
                {queryLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Ask"}
              </Button>
            </div>
            {queryError && queryError !== "CLAUDE_NOT_FOUND" && (
              <p className="text-red-400 text-sm">{queryError}</p>
            )}
            {queryResult && (
              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{queryResult}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
