import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validateBody, createTagSchema, updateTagSchema, deleteTagSchema } from '@/lib/validation'

export async function GET() {
  try {
    const db = getDb()
    const tags = db.prepare(
      `SELECT t.*, COUNT(tt.transaction_id) as usage_count
       FROM tags t
       LEFT JOIN transaction_tags tt ON t.id = tt.tag_id
       GROUP BY t.id
       ORDER BY t.name`
    ).all()
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const parsed = validateBody(createTagSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { name, color } = parsed.data

    const id = crypto.randomUUID()
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name, color)

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
    return NextResponse.json({ tag }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 })
    }
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const parsed = validateBody(updateTagSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { id, name, color } = parsed.data

    db.prepare(
      'UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?'
    ).run(name ?? null, color ?? null, id)

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Error updating tag:', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const parsed = validateBody(deleteTagSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { id } = parsed.data

    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
