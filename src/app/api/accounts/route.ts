import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all()
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { name, type, institution, currency } = await request.json()

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    db.prepare(
      'INSERT INTO accounts (id, name, type, institution, currency) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, type, institution || '', currency || 'USD')

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
