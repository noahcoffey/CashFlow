"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Check, AlertCircle, ArrowRight, X, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Account {
  id: string
  name: string
}

interface ColumnMapping {
  date: string
  description: string
  description2?: string
  amount: string
  credit?: string
  debit?: string
}

interface FileResult {
  name: string
  imported: number
  duplicates: number
  matched: number
}

type Step = "upload" | "mapping" | "preview" | "importing" | "done"

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState("")
  const [step, setStep] = useState<Step>("upload")
  const [files, setFiles] = useState<File[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [sampleRows, setSampleRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ date: "", description: "", amount: "" })
  const [format, setFormat] = useState("")
  const [totalRows, setTotalRows] = useState(0)
  const [results, setResults] = useState<FileResult[]>([])
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, fileName: "" })
  const [dragActive, setDragActive] = useState(false)
  const [amountMode, setAmountMode] = useState<"single" | "split">("single")
  const [accountsError, setAccountsError] = useState<string | null>(null)

  const loadAccounts = async () => {
    setAccountsError(null)
    try {
      const res = await fetch("/api/accounts")
      if (!res.ok) throw new Error(`Failed to load accounts (${res.status})`)
      const d = await res.json()
      setAccounts(d.accounts || [])
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : "Failed to load accounts")
    }
  }

  useEffect(() => { loadAccounts() }, [])

  const handleFiles = async (newFiles: FileList | File[]) => {
    const csvFiles = Array.from(newFiles).filter(f => f.name.endsWith(".csv") || f.type === "text/csv")
    if (csvFiles.length === 0) {
      toast.error("Please select CSV files")
      return
    }
    setFiles(csvFiles)

    // Parse the first file to detect column mapping
    const formData = new FormData()
    formData.append("file", csvFiles[0])

    try {
      const res = await fetch("/api/import/parse", { method: "POST", body: formData })
      if (!res.ok) {
        toast.error(`Failed to parse CSV (${res.status})`)
        return
      }
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        return
      }
      setHeaders(data.headers)
      setSampleRows(data.sampleRows)
      setMapping(data.mapping)
      setFormat(data.format)
      // Sum up total rows across all files (estimate for now, first file is exact)
      setTotalRows(data.totalRows)
      if (!data.mapping.amount && (data.mapping.credit || data.mapping.debit)) {
        setAmountMode("split")
      } else {
        setAmountMode("single")
      }
      setStep("mapping")
    } catch {
      toast.error("Failed to parse CSV")
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 0) setStep("upload")
      return next
    })
  }

  const parseAndImportFile = async (file: File): Promise<FileResult> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("mapping", JSON.stringify(mapping))

    const parseRes = await fetch("/api/import/parse", { method: "POST", body: formData })
    if (!parseRes.ok) throw new Error(`Failed to parse ${file.name} (${parseRes.status})`)
    const parseData = await parseRes.json()

    const { headers: h, allRows } = parseData
    const dateIdx = h.indexOf(mapping.date)
    const descIdx = h.indexOf(mapping.description)
    const desc2Idx = mapping.description2 ? h.indexOf(mapping.description2) : -1
    const amountIdx = mapping.amount ? h.indexOf(mapping.amount) : -1
    const creditIdx = mapping.credit ? h.indexOf(mapping.credit) : -1
    const debitIdx = mapping.debit ? h.indexOf(mapping.debit) : -1

    const transactions = (allRows || parseData.sampleRows || [])
      .map((row: string[]) => {
        const date = dateIdx >= 0 ? row[dateIdx] : ""
        const desc1 = descIdx >= 0 ? (row[descIdx] || "").trim() : ""
        const desc2 = desc2Idx >= 0 ? (row[desc2Idx] || "").trim() : ""
        const description = desc2 && desc2 !== desc1 ? `${desc1} — ${desc2}` : desc1
        let amount = 0
        if (amountIdx >= 0) {
          amount = parseFloat((row[amountIdx] || "0").replace(/[$,]/g, "").replace(/[()]/g, (m: string) => m === "(" ? "-" : ""))
        } else if (creditIdx >= 0 && debitIdx >= 0) {
          const credit = parseFloat((row[creditIdx] || "0").replace(/[$,]/g, "")) || 0
          const debit = parseFloat((row[debitIdx] || "0").replace(/[$,]/g, "")) || 0
          amount = credit > 0 ? credit : -Math.abs(debit)
        }
        return { date, raw_description: description, amount }
      })
      .filter((t: any) => t.date && t.raw_description && t.amount !== 0)

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, transactions }),
    })
    if (!res.ok) throw new Error(`Import failed for ${file.name} (${res.status})`)
    const data = await res.json()
    return { name: file.name, imported: data.imported, duplicates: data.duplicates, matched: data.matched }
  }

  const handleImport = async () => {
    if (!accountId) {
      toast.error("Please select an account")
      return
    }
    setStep("importing")
    setImportProgress({ current: 0, total: files.length, fileName: "" })

    const allResults: FileResult[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        setImportProgress({ current: i + 1, total: files.length, fileName: files[i].name })
        const result = await parseAndImportFile(files[i])
        allResults.push(result)
      }
      setResults(allResults)
      setStep("done")
      const totalImported = allResults.reduce((s, r) => s + r.imported, 0)
      toast.success(`Imported ${totalImported} transactions from ${files.length} file${files.length > 1 ? "s" : ""}`)
    } catch {
      toast.error("Import failed")
      setStep("preview")
    }
  }

  const totalImported = results.reduce((s, r) => s + r.imported, 0)
  const totalDuplicates = results.reduce((s, r) => s + r.duplicates, 0)
  const totalMatched = results.reduce((s, r) => s + r.matched, 0)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Import Transactions</h1>
        <p className="text-zinc-500 text-sm">Upload CSV files from your bank</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {["Upload", "Map Columns", "Preview & Import", "Done"].map((label, i) => {
          const stepMap: Step[] = ["upload", "mapping", "preview", "done"]
          const stepIdx = stepMap.indexOf(step)
          const isActive = i <= (step === "importing" ? 2 : stepIdx)
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${isActive ? "bg-blue-500" : "bg-zinc-700"}`} />}
              <div className={`flex items-center gap-1.5 ${isActive ? "text-blue-400" : "text-zinc-600"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isActive ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-500"}`}>
                  {i < stepIdx || step === "done" ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Error loading accounts */}
      {accountsError && (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
              <h2 className="text-lg font-semibold text-zinc-200">Failed to load accounts</h2>
              <p className="text-sm text-zinc-500 mt-1 mb-4">{accountsError}</p>
              <Button variant="outline" size="sm" onClick={loadAccounts}>
                <RefreshCw className="h-4 w-4 mr-1" /> Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Upload */}
      {step === "upload" && (
        <Card>
          <CardContent className="p-8">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive ? "border-blue-500 bg-blue-500/5" : "border-zinc-700 hover:border-zinc-600"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
              <p className="text-zinc-300 font-medium mb-2">Drop your CSV files here</p>
              <p className="text-zinc-500 text-sm mb-4">You can drop multiple files at once</p>
              <input
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                id="csv-upload"
                onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>Choose Files</span>
                </Button>
              </label>
            </div>
            <div className="mt-6 text-xs text-zinc-500 space-y-1">
              <p>Supported formats: Chase, Bank of America, Capital One, Mint, YNAB, and generic CSV</p>
              <p>All files will use the same column mapping (detected from the first file)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Mapping */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Column Mapping
              {format !== "generic" && <Badge>{format.toUpperCase()} format detected</Badge>}
            </CardTitle>
            <CardDescription>
              {files.length} file{files.length > 1 ? "s" : ""} selected — mapping from {files[0]?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File list */}
            {files.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Files to import:</label>
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-800/50 text-sm">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <FileText className="h-3.5 w-3.5 text-zinc-500" />
                        {f.name}
                      </div>
                      <button onClick={() => removeFile(i)} className="text-zinc-500 hover:text-zinc-300">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Date Column *</label>
                <Select value={mapping.date} onChange={(e) => setMapping({ ...mapping, date: e.target.value })}>
                  <option value="">Select column</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Description Column *</label>
                <Select value={mapping.description} onChange={(e) => setMapping({ ...mapping, description: e.target.value })}>
                  <option value="">Select column</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Second Description</label>
                <Select value={mapping.description2 || ""} onChange={(e) => setMapping({ ...mapping, description2: e.target.value || undefined })}>
                  <option value="">None</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
                <p className="text-xs text-zinc-600 mt-1">e.g. Memo — combined with description</p>
              </div>
            </div>

            {/* Amount mode toggle */}
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Amount Format *</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={amountMode === "single" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAmountMode("single")
                    setMapping({ ...mapping, credit: undefined, debit: undefined })
                  }}
                >
                  Single Amount Column
                </Button>
                <Button
                  type="button"
                  variant={amountMode === "split" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAmountMode("split")
                    setMapping({ ...mapping, amount: "" })
                  }}
                >
                  Separate Credit / Debit Columns
                </Button>
              </div>
            </div>

            {amountMode === "single" ? (
              <div className="max-w-xs">
                <label className="text-sm text-zinc-400 mb-1 block">Amount Column *</label>
                <Select value={mapping.amount || ""} onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}>
                  <option value="">Select column</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Credit / Deposit Column *</label>
                  <Select value={mapping.credit || ""} onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}>
                    <option value="">Select column</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                  <p className="text-xs text-zinc-600 mt-1">Money coming in (positive amounts)</p>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Debit / Withdrawal Column *</label>
                  <Select value={mapping.debit || ""} onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}>
                    <option value="">Select column</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                  <p className="text-xs text-zinc-600 mt-1">Money going out (treated as negative)</p>
                </div>
              </div>
            )}

            {/* Sample data preview */}
            <div className="mt-4">
              <p className="text-sm text-zinc-400 mb-2">Preview (first 5 rows from {files[0]?.name}):</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {headers.map((h) => (
                        <th key={h} className={`p-2 text-left text-xs ${
                          h === mapping.date ? "text-blue-400" :
                          h === mapping.description ? "text-emerald-400" :
                          h === mapping.description2 ? "text-teal-400" :
                          h === mapping.amount && amountMode === "single" ? "text-amber-400" :
                          h === mapping.credit && amountMode === "split" ? "text-green-400" :
                          h === mapping.debit && amountMode === "split" ? "text-red-400" :
                          "text-zinc-500"
                        }`}>
                          {h}
                          {h === mapping.date && " (Date)"}
                          {h === mapping.description && " (Desc)"}
                          {h === mapping.description2 && " (Desc 2)"}
                          {h === mapping.amount && amountMode === "single" && " (Amount)"}
                          {h === mapping.credit && amountMode === "split" && " (Credit)"}
                          {h === mapping.debit && amountMode === "split" && " (Debit)"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800/50">
                        {row.map((cell, j) => (
                          <td key={j} className="p-2 text-zinc-300 max-w-xs truncate">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => { setStep("upload"); setFiles([]) }}>Back</Button>
              <Button onClick={() => setStep("preview")} disabled={!mapping.date || !mapping.description || (amountMode === "single" ? !mapping.amount : (!mapping.credit || !mapping.debit))}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview & Import */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Import</CardTitle>
            <CardDescription>
              {files.length} file{files.length > 1 ? "s" : ""}: {files.map(f => f.name).join(", ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Import into Account *</label>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Select account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              {accounts.length === 0 && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> No accounts found. Create one in Settings first.
                </p>
              )}
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>Back</Button>
              <Button onClick={handleImport} disabled={!accountId}>
                Import {files.length} File{files.length > 1 ? "s" : ""}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-zinc-300">Importing transactions...</p>
            {files.length > 1 && (
              <p className="text-zinc-500 text-sm mt-1">
                File {importProgress.current} of {importProgress.total}: {importProgress.fileName}
              </p>
            )}
            <p className="text-zinc-600 text-xs mt-1">Deduplicating and matching aliases</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && results.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">Import Complete</h2>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="p-3 rounded-lg bg-zinc-800/50">
                <p className="text-2xl font-bold text-emerald-400">{totalImported}</p>
                <p className="text-xs text-zinc-500">Imported</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/50">
                <p className="text-2xl font-bold text-amber-400">{totalDuplicates}</p>
                <p className="text-xs text-zinc-500">Duplicates</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/50">
                <p className="text-2xl font-bold text-blue-400">{totalMatched}</p>
                <p className="text-xs text-zinc-500">Auto-matched</p>
              </div>
            </div>

            {/* Per-file breakdown */}
            {results.length > 1 && (
              <div className="mt-4 text-left max-w-md mx-auto">
                <p className="text-sm text-zinc-400 mb-2">Per-file breakdown:</p>
                <div className="space-y-1.5">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-800/30 text-sm">
                      <span className="text-zinc-300 truncate mr-4">{r.name}</span>
                      <div className="flex gap-3 text-xs shrink-0">
                        <span className="text-emerald-400">{r.imported} new</span>
                        <span className="text-amber-400">{r.duplicates} dup</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center mt-4">
              <Button variant="outline" onClick={() => { setStep("upload"); setFiles([]); setResults([]) }}>
                Import More
              </Button>
              <Button onClick={() => window.location.href = "/transactions"}>
                View Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
