import { NextResponse } from 'next/server'
import { runClaudePrompt, extractJSON } from '@/lib/ai'
import { getDb } from '@/lib/db'
import { format, startOfMonth } from 'date-fns'

export async function GET(request: Request) {
  const routeStart = Date.now()
  console.log('[anomalies] Request received')
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Check cache
    if (!forceRefresh) {
      const cached = db.prepare(
        `SELECT result, created_at FROM ai_cache
         WHERE type = 'anomalies'
         AND datetime(created_at) > datetime('now', '-1 hour')
         ORDER BY created_at DESC LIMIT 1`
      ).get() as { result: string; created_at: string } | undefined

      if (cached) {
        console.log(`[anomalies] Cache hit (created: ${cached.created_at})`)
        return NextResponse.json(JSON.parse(cached.result))
      }
      console.log('[anomalies] Cache miss, will query Claude')
    } else {
      console.log('[anomalies] Force refresh requested')
    }

    const now = new Date()
    const currentMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')

    // Per-category historical average spend
    const averages = db.prepare(`
      SELECT
        c.name AS category,
        ROUND(AVG(monthly_total), 2) AS average_amount,
        COUNT(DISTINCT month) AS months_with_data
      FROM (
        SELECT
          t.category_id,
          strftime('%Y-%m', t.date) AS month,
          SUM(ABS(t.amount)) AS monthly_total
        FROM transactions t
        WHERE t.amount < 0
          AND t.date < ?
        GROUP BY t.category_id, strftime('%Y-%m', t.date)
      ) monthly
      JOIN categories c ON monthly.category_id = c.id
      GROUP BY c.name
    `).all(currentMonthStart) as { category: string; average_amount: number; months_with_data: number }[]

    // Current month spend per category
    const currentMonth = db.prepare(`
      SELECT
        c.name AS category,
        ROUND(SUM(ABS(t.amount)), 2) AS current_amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.date >= ?
        AND t.amount < 0
      GROUP BY c.name
    `).all(currentMonthStart) as { category: string; current_amount: number }[]

    console.log(`[anomalies] Found ${averages.length} historical categories, ${currentMonth.length} current month categories`)

    if (!averages.length && !currentMonth.length) {
      console.log('[anomalies] No data, returning 400')
      return NextResponse.json({ error: 'No transaction data available for anomaly detection' }, { status: 400 })
    }

    // Merge data for the prompt
    const categoryData = averages.map((avg) => {
      const current = currentMonth.find((c) => c.category === avg.category)
      return {
        category: avg.category,
        average_amount: avg.average_amount,
        current_amount: current?.current_amount ?? 0,
        months_with_data: avg.months_with_data,
      }
    })

    // Include categories that appear this month but have no history
    for (const cur of currentMonth) {
      if (!categoryData.find((d) => d.category === cur.category)) {
        categoryData.push({
          category: cur.category,
          average_amount: 0,
          current_amount: cur.current_amount,
          months_with_data: 0,
        })
      }
    }

    const prompt = `You are a personal finance analyst. Given the following per-category data showing historical average monthly spending and current month spending, identify categories with unusually high or low spending.

Category data:
${JSON.stringify(categoryData, null, 2)}

Current month: ${format(now, 'MMMM yyyy')}
Note: The current month may not be complete yet (today is ${format(now, 'yyyy-MM-dd')}).

For each category, classify spending as "high", "low", or "normal" and explain why.

Respond ONLY with valid JSON, no other text. Use this exact format:
[{ "category": "string", "average_amount": number, "current_amount": number, "status": "high" | "low" | "normal", "reasoning": "string" }]`

    console.log(`[anomalies] Sending prompt (${prompt.length} chars) to Claude...`)
    const response = await runClaudePrompt(prompt, 'anomalies')
    const result = extractJSON(response)

    if (!result) {
      console.error('[anomalies] Failed to extract JSON from response')
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    console.log(`[anomalies] Got ${Array.isArray(result) ? result.length : 'object'} results, caching`)

    // Cache the result
    db.prepare(
      `INSERT INTO ai_cache (id, type, result) VALUES (?, 'anomalies', ?)`
    ).run(crypto.randomUUID(), JSON.stringify(result))

    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    console.log(`[anomalies] Done in ${elapsed}s`)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    if (error instanceof Error && error.message === 'CLAUDE_NOT_FOUND') {
      console.error(`[anomalies] Claude CLI not found (${elapsed}s)`)
      return NextResponse.json({ error: 'CLAUDE_NOT_FOUND' }, { status: 503 })
    }
    console.error(`[anomalies] Error after ${elapsed}s:`, error)
    return NextResponse.json({ error: 'Failed to detect anomalies' }, { status: 500 })
  }
}
