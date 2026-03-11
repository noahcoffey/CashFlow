import { NextResponse } from 'next/server'
import { runCheckpoint, runVacuum, runIntegrityCheck } from '@/lib/db'

export async function GET() {
  try {
    const integrity = runIntegrityCheck()
    const isHealthy = integrity.length === 1 && integrity[0] === 'ok'

    return NextResponse.json({
      healthy: isHealthy,
      integrity,
    })
  } catch (error) {
    console.error('Error checking database health:', error)
    return NextResponse.json({ error: 'Failed to check database health' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json()

    if (action === 'optimize') {
      const checkpoint = runCheckpoint()
      runVacuum()
      return NextResponse.json({
        success: true,
        message: 'Database optimized',
        checkpoint,
      })
    }

    if (action === 'checkpoint') {
      const checkpoint = runCheckpoint()
      return NextResponse.json({
        success: true,
        message: 'WAL checkpoint completed',
        checkpoint,
      })
    }

    if (action === 'integrity-check') {
      const results = runIntegrityCheck()
      const isHealthy = results.length === 1 && results[0] === 'ok'
      return NextResponse.json({
        healthy: isHealthy,
        results,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error performing database action:', error)
    return NextResponse.json({ error: 'Failed to perform database action' }, { status: 500 })
  }
}
