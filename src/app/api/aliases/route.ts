import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { applyAliasesToTransactions } from '@/lib/alias-engine'

export async function GET() {
  try {
    const db = getDb()
    const aliases = db.prepare(
      `SELECT ma.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM merchant_aliases ma
       LEFT JOIN categories c ON ma.category_id = c.id
       ORDER BY ma.match_count DESC, ma.created_at DESC`
    ).all()
    return NextResponse.json({ aliases })
  } catch (error) {
    console.error('Error fetching aliases:', error)
    return NextResponse.json({ error: 'Failed to fetch aliases' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { raw_pattern, display_name, category_id, apply_retroactively } = await request.json()

    if (!raw_pattern || !display_name) {
      return NextResponse.json({ error: 'raw_pattern and display_name are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    db.prepare(
      'INSERT INTO merchant_aliases (id, raw_pattern, display_name, category_id) VALUES (?, ?, ?, ?)'
    ).run(id, raw_pattern, display_name, category_id || null)

    let retroactiveResult = null
    if (apply_retroactively) {
      retroactiveResult = applyAliasesToTransactions()
    }

    const alias = db.prepare(
      `SELECT ma.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM merchant_aliases ma
       LEFT JOIN categories c ON ma.category_id = c.id
       WHERE ma.id = ?`
    ).get(id)

    return NextResponse.json({
      alias,
      retroactive: retroactiveResult,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating alias:', error)
    return NextResponse.json({ error: 'Failed to create alias' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const { id, raw_pattern, display_name, category_id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Alias id is required' }, { status: 400 })
    }

    db.prepare(
      `UPDATE merchant_aliases SET
        raw_pattern = COALESCE(?, raw_pattern),
        display_name = COALESCE(?, display_name),
        category_id = ?
       WHERE id = ?`
    ).run(raw_pattern || null, display_name || null, category_id !== undefined ? (category_id || null) : null, id)

    const updated = db.prepare(
      `SELECT ma.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM merchant_aliases ma
       LEFT JOIN categories c ON ma.category_id = c.id
       WHERE ma.id = ?`
    ).get(id)

    return NextResponse.json({ alias: updated })
  } catch (error) {
    console.error('Error updating alias:', error)
    return NextResponse.json({ error: 'Failed to update alias' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Alias id is required' }, { status: 400 })
    }

    const result = db.prepare('DELETE FROM merchant_aliases WHERE id = ?').run(id)
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Alias not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting alias:', error)
    return NextResponse.json({ error: 'Failed to delete alias' }, { status: 500 })
  }
}
