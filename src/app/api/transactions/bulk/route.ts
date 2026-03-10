import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const { ids, transactionIds, category_id } = await request.json()
    const idList = ids || transactionIds

    if (!Array.isArray(idList) || idList.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    const placeholders = idList.map(() => '?').join(',')
    const result = db.prepare(
      `UPDATE transactions SET category_id = ? WHERE id IN (${placeholders})`
    ).run(category_id || null, ...idList)

    return NextResponse.json({ updated: result.changes })
  } catch (error) {
    console.error('Error bulk updating transactions:', error)
    return NextResponse.json({ error: 'Failed to bulk update transactions' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    const placeholders = ids.map(() => '?').join(',')
    const result = db.prepare(
      `DELETE FROM transactions WHERE id IN (${placeholders})`
    ).run(...ids)

    return NextResponse.json({ deleted: result.changes })
  } catch (error) {
    console.error('Error bulk deleting transactions:', error)
    return NextResponse.json({ error: 'Failed to bulk delete transactions' }, { status: 500 })
  }
}
