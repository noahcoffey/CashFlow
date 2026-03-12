import { NextResponse } from 'next/server'
import { runClaudePrompt, extractJSON } from '@/lib/ai'
import { getDb } from '@/lib/db'
import { subMonths, format, startOfMonth } from 'date-fns'

export async function GET(request: Request) {
  const routeStart = Date.now()
  console.log('[budget-suggestions] Request received')
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Check cache
    if (!forceRefresh) {
      const cached = db.prepare(
        `SELECT result, created_at FROM ai_cache
         WHERE type = 'budget_suggestions'
         AND datetime(created_at) > datetime('now', '-1 hour')
         ORDER BY created_at DESC LIMIT 1`
      ).get() as { result: string; created_at: string } | undefined

      if (cached) {
        console.log(`[budget-suggestions] Cache hit (created: ${cached.created_at})`)
        return NextResponse.json(JSON.parse(cached.result))
      }
      console.log('[budget-suggestions] Cache miss, will query Claude')
    } else {
      console.log('[budget-suggestions] Force refresh requested')
    }

    // Query 6 months of category spending averages
    const now = new Date()
    const sixMonthsAgo = format(startOfMonth(subMonths(now, 6)), 'yyyy-MM-dd')

    const averages = db.prepare(`
      SELECT
        c.name AS category,
        c.budget_amount AS current_budget,
        ROUND(AVG(monthly_total), 2) AS avg_monthly_spend,
        MIN(monthly_total) AS min_monthly_spend,
        MAX(monthly_total) AS max_monthly_spend,
        COUNT(DISTINCT month) AS months_with_data
      FROM (
        SELECT
          t.category_id,
          strftime('%Y-%m', t.date) AS month,
          SUM(ABS(t.amount)) AS monthly_total
        FROM transactions t
        WHERE t.date >= ?
          AND t.amount < 0
        GROUP BY t.category_id, strftime('%Y-%m', t.date)
      ) monthly
      JOIN categories c ON monthly.category_id = c.id
      GROUP BY c.name, c.budget_amount
      ORDER BY avg_monthly_spend DESC
    `).all(sixMonthsAgo)

    console.log(`[budget-suggestions] Found ${averages.length} category averages`)

    if (!averages.length) {
      console.log('[budget-suggestions] No data, returning 400')
      return NextResponse.json({ error: 'No transaction data available for budget suggestions' }, { status: 400 })
    }

    const prompt = `You are a personal finance advisor. Given the following 6-month category spending averages and current budget settings, recommend optimal budget amounts for each category.

Spending data:
${JSON.stringify(averages, null, 2)}

Consider spending trends, variability, and practical budgeting principles. If a current budget is set to 0, it means no budget has been configured yet.

Respond ONLY with valid JSON, no other text. Use this exact format:
[{ "category": "string", "recommended_amount": number, "current_budget": number, "reasoning": "string" }]`

    console.log(`[budget-suggestions] Sending prompt (${prompt.length} chars) to Claude...`)
    const response = await runClaudePrompt(prompt, 'budget-suggestions')
    const result = extractJSON(response)

    if (!result) {
      console.error('[budget-suggestions] Failed to extract JSON from response')
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    console.log(`[budget-suggestions] Got ${Array.isArray(result) ? result.length : 'object'} results, caching`)

    // Cache the result
    db.prepare(
      `INSERT INTO ai_cache (id, type, result) VALUES (?, 'budget_suggestions', ?)`
    ).run(crypto.randomUUID(), JSON.stringify(result))

    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    console.log(`[budget-suggestions] Done in ${elapsed}s`)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const elapsed = ((Date.now() - routeStart) / 1000).toFixed(1)
    if (error instanceof Error && error.message === 'CLAUDE_NOT_FOUND') {
      console.error(`[budget-suggestions] Claude CLI not found (${elapsed}s)`)
      return NextResponse.json({ error: 'CLAUDE_NOT_FOUND' }, { status: 503 })
    }
    console.error(`[budget-suggestions] Error after ${elapsed}s:`, error)
    return NextResponse.json({ error: 'Failed to generate budget suggestions' }, { status: 500 })
  }
}
