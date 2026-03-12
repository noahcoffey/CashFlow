import { NextResponse } from 'next/server'
import { runClaudePrompt } from '@/lib/ai'
import { getDb } from '@/lib/db'
import { format, startOfMonth } from 'date-fns'
import { aiQuerySchema, validateBody } from '@/lib/validation'

export async function POST(request: Request) {
  const routeStart = Date.now()
  console.log('[query] Request received')
  try {
    const db = getDb()
    const body = await request.json()

    const validation = validateBody(aiQuerySchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }
    const { question } = validation.data

    console.log(`[query] Question: ${question.substring(0, 100)}`)

    const now = new Date()
    const currentMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')

    // Build context: total accounts
    const accountCount = db.prepare(
      'SELECT COUNT(*) AS count FROM accounts'
    ).get() as { count: number }

    // Total transactions
    const transactionCount = db.prepare(
      'SELECT COUNT(*) AS count FROM transactions'
    ).get() as { count: number }

    // Current month spending by category
    const monthlySpending = db.prepare(`
      SELECT
        c.name AS category,
        ROUND(SUM(ABS(t.amount)), 2) AS total_spent,
        COUNT(*) AS transaction_count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.date >= ?
        AND t.amount < 0
      GROUP BY c.name
      ORDER BY total_spent DESC
    `).all(currentMonthStart)

    // Account balances (sum of all transactions per account)
    const balances = db.prepare(`
      SELECT
        a.name AS account_name,
        a.type AS account_type,
        ROUND(SUM(t.amount), 2) AS balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id
      GROUP BY a.id, a.name, a.type
    `).all()

    console.log(`[query] Context: ${accountCount.count} accounts, ${transactionCount.count} transactions, ${monthlySpending.length} spending categories`)

    const prompt = `You are a helpful personal finance assistant for a cashflow tracking app. Answer the user's question based on the following financial context.

Context:
- Total accounts: ${accountCount.count}
- Total transactions: ${transactionCount.count}
- Current month (${format(now, 'MMMM yyyy')}) spending by category:
${JSON.stringify(monthlySpending, null, 2)}
- Account balances:
${JSON.stringify(balances, null, 2)}

User's question: ${question}

Provide a clear, concise, and helpful answer. If the data doesn't contain enough information to fully answer the question, say so.`

    console.log(`[query] Sending prompt (${prompt.length} chars) to Claude...`)
    const response = await runClaudePrompt(prompt, 'query')

    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    console.log(`[query] Done in ${elapsed}s (response: ${response.length} chars)`)
    return NextResponse.json({ answer: response })
  } catch (error: unknown) {
    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    if (error instanceof Error && error.message === 'CLAUDE_NOT_FOUND') {
      console.error(`[query] Claude CLI not found (${elapsed}s)`)
      return NextResponse.json({ error: 'CLAUDE_NOT_FOUND' }, { status: 503 })
    }
    console.error(`[query] Error after ${elapsed}s:`, error)
    return NextResponse.json({ error: 'Failed to process query' }, { status: 500 })
  }
}
