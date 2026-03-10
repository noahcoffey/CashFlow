import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const categories = db.prepare(
      `SELECT c.*, p.name as parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       ORDER BY c.type, c.name`
    ).all()
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { name, parent_id, color, icon, type, budget_amount, budget_period } = await request.json()

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO categories (id, name, parent_id, color, icon, type, budget_amount, budget_period)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, parent_id || null, color || '#6B7280', icon || '📁', type, budget_amount || 0, budget_period || 'monthly')

    const category = db.prepare(
      `SELECT c.*, p.name as parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE c.id = ?`
    ).get(id)

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const { id, name, parent_id, color, icon, type, budget_amount, budget_period } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 })
    }

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    db.prepare(
      `UPDATE categories SET
        name = COALESCE(?, name),
        parent_id = ?,
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        type = COALESCE(?, type),
        budget_amount = COALESCE(?, budget_amount),
        budget_period = COALESCE(?, budget_period)
       WHERE id = ?`
    ).run(
      name || null,
      parent_id !== undefined ? parent_id : null,
      color || null,
      icon || null,
      type || null,
      budget_amount ?? null,
      budget_period || null,
      id
    )

    const updated = db.prepare(
      `SELECT c.*, p.name as parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE c.id = ?`
    ).get(id)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 })
    }

    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
