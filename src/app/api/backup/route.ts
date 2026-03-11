import { NextResponse } from 'next/server'
import { getDb, getDbPath, closeDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

export async function GET() {
  try {
    // Checkpoint WAL before backup to ensure all data is in the main DB file
    const db = getDb()
    db.pragma('wal_checkpoint(RESTART)')

    const dbPath = getDbPath()
    const fileBuffer = fs.readFileSync(dbPath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `cashflow-backup-${timestamp}.db`

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'File must be a .db SQLite database' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate the uploaded file is a valid SQLite database
    const tempPath = path.join(process.cwd(), `restore-temp-${Date.now()}.db`)
    try {
      fs.writeFileSync(tempPath, buffer)
      const testDb = new Database(tempPath, { readonly: true })
      const integrity = testDb.pragma('integrity_check') as Array<{ integrity_check: string }>
      const isValid = integrity.length > 0 && integrity[0].integrity_check === 'ok'

      // Check that it has the expected tables
      const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      const tableNames = tables.map(t => t.name)
      const requiredTables = ['accounts', 'transactions', 'categories']
      const missingTables = requiredTables.filter(t => !tableNames.includes(t))

      testDb.close()

      if (!isValid) {
        fs.unlinkSync(tempPath)
        return NextResponse.json({ error: 'Uploaded database failed integrity check' }, { status: 400 })
      }

      if (missingTables.length > 0) {
        fs.unlinkSync(tempPath)
        return NextResponse.json({ error: `Not a valid CashFlow database — missing tables: ${missingTables.join(', ')}` }, { status: 400 })
      }
    } catch (validationError) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
      return NextResponse.json({ error: 'File is not a valid SQLite database' }, { status: 400 })
    }

    // Validation passed — replace the current database
    const dbPath = getDbPath()
    closeDb()

    // Replace the database file
    fs.copyFileSync(tempPath, dbPath)
    fs.unlinkSync(tempPath)

    // Remove WAL and SHM files if they exist
    const walPath = dbPath + '-wal'
    const shmPath = dbPath + '-shm'
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)

    return NextResponse.json({ success: true, message: 'Database restored. Please refresh the page.' })
  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 })
  }
}
