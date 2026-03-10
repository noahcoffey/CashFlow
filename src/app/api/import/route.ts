import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { applyAliasesToTransactions } from '@/lib/alias-engine'
import { parseDate } from '@/lib/csv-parser'

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { accountId, transactions } = await request.json()

    if (!accountId || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'accountId and transactions array are required' }, { status: 400 })
    }

    const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId)
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    let imported = 0
    let duplicates = 0
    const newIds: string[] = []

    const insertStmt = db.prepare(
      `INSERT INTO transactions (id, account_id, date, amount, raw_description)
       VALUES (?, ?, ?, ?, ?)`
    )

    const findDuplicates = db.prepare(
      `SELECT raw_description FROM transactions
       WHERE account_id = ? AND date = ? AND amount = ?`
    )

    const importAll = db.transaction(() => {
      for (const t of transactions) {
        // Normalize date to ISO format (YYYY-MM-DD)
        const normalizedDate = parseDate(t.date)
        const fingerprint = `${normalizedDate}|${t.amount.toFixed(2)}|${t.raw_description.toLowerCase().replace(/\s+/g, ' ').trim()}`

        // Check for duplicates by matching account_id, date, amount and comparing descriptions
        const existing = findDuplicates.all(accountId, normalizedDate, t.amount) as { raw_description: string }[]
        const isDuplicate = existing.some(e => {
          const existingFingerprint = `${normalizedDate}|${t.amount.toFixed(2)}|${e.raw_description.toLowerCase().replace(/\s+/g, ' ').trim()}`
          return existingFingerprint === fingerprint
        })

        if (isDuplicate) {
          duplicates++
          continue
        }

        const id = crypto.randomUUID()
        insertStmt.run(id, accountId, normalizedDate, t.amount, t.raw_description)
        newIds.push(id)
        imported++
      }
    })

    importAll()

    // Apply alias matching to newly imported transactions
    let matched = 0
    if (newIds.length > 0) {
      const result = applyAliasesToTransactions(newIds)
      matched = result.matched
    }

    return NextResponse.json({ imported, duplicates, matched })
  } catch (error) {
    console.error('Error importing transactions:', error)
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 })
  }
}
