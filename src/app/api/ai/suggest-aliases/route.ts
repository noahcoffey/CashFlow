import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { runClaudePrompt, extractJSON } from '@/lib/ai'

export async function POST() {
  try {
    const db = getDb()

    // Get recent transactions without display names (unaliased)
    const unaliased = db.prepare(
      `SELECT DISTINCT raw_description, COUNT(*) as count
       FROM transactions
       WHERE (display_name IS NULL OR display_name = '')
       GROUP BY raw_description
       ORDER BY count DESC
       LIMIT 50`
    ).all() as { raw_description: string; count: number }[]

    // Also get transactions WITH display names but no alias exists for them
    const aliasedManually = db.prepare(
      `SELECT DISTINCT raw_description, display_name, COUNT(*) as count
       FROM transactions
       WHERE display_name IS NOT NULL AND display_name != ''
         AND raw_description NOT IN (SELECT raw_pattern FROM merchant_aliases)
       GROUP BY raw_description
       ORDER BY count DESC
       LIMIT 20`
    ).all() as { raw_description: string; display_name: string; count: number }[]

    if (unaliased.length === 0 && aliasedManually.length === 0) {
      return NextResponse.json({ suggestions: [], message: 'All transactions already have aliases!' })
    }

    // Get existing aliases for context
    const existingAliases = db.prepare(
      `SELECT ma.raw_pattern, ma.display_name, c.name as category_name
       FROM merchant_aliases ma
       LEFT JOIN categories c ON ma.category_id = c.id
       ORDER BY ma.match_count DESC`
    ).all() as { raw_pattern: string; display_name: string; category_name: string | null }[]

    // Get categories
    const categories = db.prepare(
      `SELECT id, name, icon FROM categories WHERE type = 'expense' OR type = 'income' ORDER BY name`
    ).all() as { id: string; name: string; icon: string }[]

    const prompt = `You are helping organize personal finance transactions. Analyze these raw bank transaction descriptions and suggest clean merchant aliases.

EXISTING ALIASES (for reference — don't re-suggest these, but use similar naming conventions):
${existingAliases.length > 0
  ? existingAliases.map(a => `  "${a.raw_pattern}" → "${a.display_name}"${a.category_name ? ` (${a.category_name})` : ''}`).join('\n')
  : '  (none yet)'}

AVAILABLE CATEGORIES:
${categories.map(c => `  ${c.icon} ${c.name} (id: ${c.id})`).join('\n')}

UNALIASED TRANSACTIONS (need aliases):
${unaliased.map(t => `  "${t.raw_description}" (${t.count} occurrences)`).join('\n')}

${aliasedManually.length > 0 ? `MANUALLY NAMED (could benefit from aliases to auto-apply):
${aliasedManually.map(t => `  "${t.raw_description}" → currently displayed as "${t.display_name}" (${t.count} occurrences)`).join('\n')}` : ''}

For each transaction, suggest:
1. A raw_pattern (a short, stable substring from the raw description that would match this merchant reliably — NOT the full description, just the key identifying part)
2. A clean display_name (human-friendly merchant name)
3. A category_id from the available categories (best guess)

Respond ONLY with a JSON array, no other text:
[
  { "raw_description": "original description", "raw_pattern": "KEY PART", "display_name": "Clean Name", "category_id": "cat-xxx", "category_name": "Category" }
]

Be concise with patterns — use the shortest unique substring. For example, "STARBUCKS STORE #8832 SEATTLE WA" should have pattern "STARBUCKS", not the full string.`

    console.log('[suggest-aliases] Sending prompt to Claude...')
    const response = await runClaudePrompt(prompt, 'suggest-aliases')
    const suggestions = extractJSON(response)

    if (!Array.isArray(suggestions)) {
      return NextResponse.json({ error: 'Failed to parse AI suggestions' }, { status: 500 })
    }

    return NextResponse.json({ suggestions })
  } catch (error: unknown) {
    console.error('Error suggesting aliases:', error)
    if (error instanceof Error && error.message === 'CLAUDE_NOT_FOUND') {
      return NextResponse.json({ error: 'Claude CLI not installed' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
