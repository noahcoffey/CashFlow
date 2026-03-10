import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { applyRulesToTransactions } from '@/lib/rules-engine'

export async function GET() {
  try {
    const db = getDb()
    const rules = db.prepare(
      `SELECT r.*, c.name as category_name, c.icon as category_icon
       FROM categorization_rules r
       LEFT JOIN categories c ON json_extract(r.actions, '$[0].value') = c.id
         AND json_extract(r.actions, '$[0].type') = 'set_category'
       ORDER BY r.priority DESC, r.created_at DESC`
    ).all()

    // Parse JSON fields
    const parsed = (rules as any[]).map(r => ({
      ...r,
      conditions: JSON.parse(r.conditions),
      actions: JSON.parse(r.actions),
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
    const { name, priority, conditions, actions, apply_retroactively } = await request.json()

    if (!name || !conditions?.length || !actions?.length) {
      return NextResponse.json({ error: 'name, conditions, and actions are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO categorization_rules (id, name, priority, conditions, actions)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, priority || 0, JSON.stringify(conditions), JSON.stringify(actions))

    let retroactiveResult = null
    if (apply_retroactively) {
      retroactiveResult = applyRulesToTransactions()
    }

    const rule = db.prepare('SELECT * FROM categorization_rules WHERE id = ?').get(id) as any
    rule.conditions = JSON.parse(rule.conditions)
    rule.actions = JSON.parse(rule.actions)

    return NextResponse.json({ rule, retroactive: retroactiveResult }, { status: 201 })
  } catch (error) {
    console.error('Error creating rule:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const { id, name, priority, conditions, actions, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 })
    }

    db.prepare(
      `UPDATE categorization_rules SET
        name = COALESCE(?, name),
        priority = COALESCE(?, priority),
        conditions = COALESCE(?, conditions),
        actions = COALESCE(?, actions),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`
    ).run(
      name || null,
      priority ?? null,
      conditions ? JSON.stringify(conditions) : null,
      actions ? JSON.stringify(actions) : null,
      is_active ?? null,
      id
    )

    const rule = db.prepare('SELECT * FROM categorization_rules WHERE id = ?').get(id) as any
    rule.conditions = JSON.parse(rule.conditions)
    rule.actions = JSON.parse(rule.actions)

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Error updating rule:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 })
    }

    db.prepare('DELETE FROM categorization_rules WHERE id = ?').run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rule:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
