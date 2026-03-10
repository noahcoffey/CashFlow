import { NextResponse } from 'next/server'
import { detectRecurring } from '@/lib/recurring-detector'

export async function GET() {
  try {
    const patterns = detectRecurring()
    const totalMonthly = patterns.reduce((s, p) => s + p.totalAnnual / 12, 0)
    return NextResponse.json({ patterns, totalMonthly })
  } catch (error) {
    console.error('Error detecting recurring transactions:', error)
    return NextResponse.json({ error: 'Failed to detect recurring transactions' }, { status: 500 })
  }
}
