import { NextResponse } from 'next/server'
import { applyRulesToTransactions } from '@/lib/rules-engine'

export async function POST() {
  try {
    const result = applyRulesToTransactions()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error applying rules:', error)
    return NextResponse.json({ error: 'Failed to apply rules' }, { status: 500 })
  }
}
