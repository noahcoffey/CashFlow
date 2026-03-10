import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Add/remove tags from transactions
export async function POST(request: Request) {
  try {
    const db = getDb()
    const { transaction_ids, tag_id, action } = await request.json()

    if (!transaction_ids?.length || !tag_id) {
      return NextResponse.json({ error: 'transaction_ids and tag_id are required' }, { status: 400 })
    }

    if (action === 'remove') {
      const stmt = db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ? AND tag_id = ?')
      const removeAll = db.transaction(() => {
        for (const txnId of transaction_ids) {
          stmt.run(txnId, tag_id)
        }
      })
      removeAll()
    } else {
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)'
      )
      const addAll = db.transaction(() => {
        for (const txnId of transaction_ids) {
          stmt.run(txnId, tag_id)
        }
      })
      addAll()
    }

    return NextResponse.json({ success: true, count: transaction_ids.length })
  } catch (error) {
    console.error('Error updating transaction tags:', error)
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 })
  }
}
