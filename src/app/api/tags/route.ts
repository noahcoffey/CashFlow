import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

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
    const { name, color } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name, color || '#6B7280')

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
    return NextResponse.json({ tag }, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 })
    }
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const { id, name, color } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Tag id is required' }, { status: 400 })
    }

    db.prepare(
      'UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?'
    ).run(name || null, color || null, id)

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
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Tag id is required' }, { status: 400 })
    }

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
