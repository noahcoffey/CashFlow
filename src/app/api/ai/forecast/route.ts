import { NextResponse } from 'next/server'
import { runClaudePrompt, extractJSON } from '@/lib/ai'
import { getDb } from '@/lib/db'
import { subMonths, format, startOfMonth } from 'date-fns'

export async function GET(request: Request) {
  const routeStart = Date.now()
  console.log('[forecast] Request received')
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Check cache
    if (!forceRefresh) {
      const cached = db.prepare(
        `SELECT result, created_at FROM ai_cache
         WHERE type = 'forecast'
         AND datetime(created_at) > datetime('now', '-1 hour')
         ORDER BY created_at DESC LIMIT 1`
      ).get() as { result: string; created_at: string } | undefined

      if (cached) {
        console.log(`[forecast] Cache hit (created: ${cached.created_at})`)
        return NextResponse.json(JSON.parse(cached.result))
      }
      console.log('[forecast] Cache miss, will query Claude')
    } else {
      console.log('[forecast] Force refresh requested')
    }

    // Query last 3 months of category-level spending aggregates
    const now = new Date()
    const threeMonthsAgo = format(startOfMonth(subMonths(now, 3)), 'yyyy-MM-dd')

    const spending = db.prepare(`
      SELECT
        c.name AS category,
        strftime('%Y-%m', t.date) AS month,
        SUM(ABS(t.amount)) AS total_amount,
        COUNT(*) AS transaction_count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.date >= ?
        AND t.amount < 0
      GROUP BY c.name, strftime('%Y-%m', t.date)
      ORDER BY c.name, month
    `).all(threeMonthsAgo)

    console.log(`[forecast] Found ${spending.length} category-month rows for prompt`)

    if (!spending.length) {
      console.log('[forecast] No spending data, returning 400')
      return NextResponse.json({ error: 'No transaction data available for forecasting' }, { status: 400 })
    }

    const prompt = `You are a personal finance analyst. Given the following category-level monthly spending data for the last 3 months, project next month's spending for each category.

Spending data:
${JSON.stringify(spending, null, 2)}

Current date: ${format(now, 'yyyy-MM-dd')}

For each category, provide a projected amount, a confidence level (high/medium/low), and brief reasoning.

Respond ONLY with valid JSON, no other text. Use this exact format:
[{ "category": "string", "projected_amount": number, "confidence": "high" | "medium" | "low", "reasoning": "string" }]`

    console.log(`[forecast] Sending prompt (${prompt.length} chars) to Claude...`)
    const response = await runClaudePrompt(prompt, 'forecast')
    const result = extractJSON(response)

    if (!result) {
      console.error('[forecast] Failed to extract JSON from response')
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    console.log(`[forecast] Got ${Array.isArray(result) ? result.length : 'object'} results, caching`)

    // Cache the result
    db.prepare(
      `INSERT INTO ai_cache (id, type, result) VALUES (?, 'forecast', ?)`
    ).run(crypto.randomUUID(), JSON.stringify(result))

    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    console.log(`[forecast] Done in ${elapsed}s`)
    return NextResponse.json(result)
  } catch (error: any) {
    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    if (error.message === 'CLAUDE_NOT_FOUND') {
      console.error(`[forecast] Claude CLI not found (${elapsed}s)`)
      return NextResponse.json({ error: 'CLAUDE_NOT_FOUND' }, { status: 503 })
    }
    console.error(`[forecast] Error after ${elapsed}s:`, error)
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 })
  }
}
