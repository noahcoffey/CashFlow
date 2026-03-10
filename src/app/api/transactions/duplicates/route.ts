import { NextResponse } from 'next/server'
import { findDuplicates } from '@/lib/duplicate-detector'

export async function GET() {
  try {
    const groups = findDuplicates()
    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error finding duplicates:', error)
    return NextResponse.json({ error: 'Failed to find duplicates' }, { status: 500 })
  }
}
