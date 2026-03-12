import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { applyRulesToTransactions } from '@/lib/rules-engine'
import { validateBody, createRuleSchema, updateRuleSchema, deleteRuleSchema } from '@/lib/validation'
import { safeParseJSON } from '@/lib/utils'

interface RuleRow {
  id: string
  name: string
  priority: number
  conditions: string
  actions: string
  is_active: number
  match_count: number
  created_at: string
  category_name: string | null
  category_icon: string | null
}

export async function GET() {
  try {
    const db = getDb()
    const rules = db.prepare(
      `SELECT r.*, c.name as category_name, c.icon as category_icon
       FROM categorization_rules r
       LEFT JOIN categories c ON json_extract(r.actions, '$[0].value') = c.id
         AND json_extract(r.actions, '$[0].type') = 'set_category'
       ORDER BY r.priority DESC, r.created_at DESC`
    ).all() as RuleRow[]

    const parsed = rules.map(r => ({
      ...r,
      conditions: safeParseJSON(r.conditions),
      actions: safeParseJSON(r.actions),
    }))

    return NextResponse.json({ rules: parsed })
  } catch (error) {
    console.error('Error fetching rules:', error)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const parsed = validateBody(createRuleSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { name, priority, conditions, actions, apply_retroactively } = parsed.data

    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO categorization_rules (id, name, priority, conditions, actions)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, priority, JSON.stringify(conditions), JSON.stringify(actions))

    let retroactiveResult = null
    if (apply_retroactively) {
      retroactiveResult = applyRulesToTransactions()
    }

    const rule = db.prepare('SELECT * FROM categorization_rules WHERE id = ?').get(id) as RuleRow
    return NextResponse.json({
      rule: {
        ...rule,
        conditions: safeParseJSON(rule.conditions),
        actions: safeParseJSON(rule.actions),
      },
      retroactive: retroactiveResult,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating rule:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const parsed = validateBody(updateRuleSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { id, name, priority, conditions, actions, is_active } = parsed.data

    db.prepare(
      `UPDATE categorization_rules SET
        name = COALESCE(?, name),
        priority = COALESCE(?, priority),
        conditions = COALESCE(?, conditions),
        actions = COALESCE(?, actions),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`
    ).run(
      name ?? null,
      priority ?? null,
      conditions ? JSON.stringify(conditions) : null,
      actions ? JSON.stringify(actions) : null,
      is_active ?? null,
      id
    )

    const rule = db.prepare('SELECT * FROM categorization_rules WHERE id = ?').get(id) as RuleRow
    return NextResponse.json({
      rule: {
        ...rule,
        conditions: safeParseJSON(rule.conditions),
        actions: safeParseJSON(rule.actions),
      },
    })
  } catch (error) {
    console.error('Error updating rule:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const parsed = validateBody(deleteRuleSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { id } = parsed.data

    db.prepare('DELETE FROM categorization_rules WHERE id = ?').run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rule:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
