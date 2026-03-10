import { NextResponse } from 'next/server'
import { applyAliasesToTransactions } from '@/lib/alias-engine'

export async function POST() {
  try {
    const result = applyAliasesToTransactions()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error re-applying aliases:', error)
    return NextResponse.json({ error: 'Failed to re-apply aliases' }, { status: 500 })
  }
}
