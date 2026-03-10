import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// GET splits for a transaction
export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const txnId = new URL(request.url).searchParams.get('transactionId')

    if (!txnId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 })
    }

    const splits = db.prepare(
      `SELECT s.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM transaction_splits s
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE s.transaction_id = ?
       ORDER BY s.created_at`
    ).all(txnId)

    return NextResponse.json({ splits })
  } catch (error) {
    console.error('Error fetching splits:', error)
    return NextResponse.json({ error: 'Failed to fetch splits' }, { status: 500 })
  }
}

// Save splits for a transaction (replaces all existing splits)
export async function POST(request: Request) {
  try {
    const db = getDb()
    const { transaction_id, splits } = await request.json()

    if (!transaction_id || !Array.isArray(splits)) {
      return NextResponse.json({ error: 'transaction_id and splits array are required' }, { status: 400 })
    }

    // Validate the transaction exists
    const txn = db.prepare('SELECT id, amount FROM transactions WHERE id = ?').get(transaction_id) as { id: string; amount: number } | undefined
    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Validate splits sum to original amount
    const splitSum = splits.reduce((sum: number, s: any) => sum + (s.amount || 0), 0)
    const diff = Math.abs(splitSum - txn.amount)
    if (diff > 0.01) {
      return NextResponse.json({
        error: `Splits must sum to transaction amount (${txn.amount.toFixed(2)}). Current sum: ${splitSum.toFixed(2)}`,
      }, { status: 400 })
    }

    const saveSplits = db.transaction(() => {
      // Remove existing splits
      db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(transaction_id)

      if (splits.length <= 1) {
        // If 0 or 1 split, just update the transaction category directly (unsplit)
        if (splits.length === 1) {
          db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?')
            .run(splits[0].category_id || null, transaction_id)
        }
        return { splits: [] }
      }

      // Insert new splits
      const stmt = db.prepare(
        'INSERT INTO transaction_splits (id, transaction_id, category_id, amount, description) VALUES (?, ?, ?, ?, ?)'
      )
      for (const split of splits) {
        stmt.run(crypto.randomUUID(), transaction_id, split.category_id || null, split.amount, split.description || '')
      }

      // Set the transaction's category to null to indicate it's split
      db.prepare('UPDATE transactions SET category_id = NULL WHERE id = ?').run(transaction_id)
    })

    saveSplits()

    const savedSplits = db.prepare(
      `SELECT s.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM transaction_splits s
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE s.transaction_id = ?
       ORDER BY s.created_at`
    ).all(transaction_id)

    return NextResponse.json({ splits: savedSplits })
  } catch (error) {
    console.error('Error saving splits:', error)
    return NextResponse.json({ error: 'Failed to save splits' }, { status: 500 })
  }
}
