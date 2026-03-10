import { NextResponse } from 'next/server'
import { parseCSV, detectColumnMapping } from '@/lib/csv-parser'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const csvText = await file.text()
    const { headers, rows, errors } = parseCSV(csvText)

    if (headers.length === 0) {
      return NextResponse.json({ error: errors[0] || 'Failed to parse CSV' }, { status: 400 })
    }

    const sampleRows = rows.slice(0, 5)
    const { mapping, format, confidence } = detectColumnMapping(headers, sampleRows)

    // Check if mapping was provided (for re-parse with full data)
    const mappingStr = formData.get('mapping') as string | null

    return NextResponse.json({
      headers,
      sampleRows,
      allRows: mappingStr ? rows : undefined,
      mapping: mappingStr ? JSON.parse(mappingStr) : mapping,
      format,
      totalRows: rows.length,
      confidence,
    })
  } catch (error) {
    console.error('Error parsing CSV:', error)
    return NextResponse.json({ error: 'Failed to parse CSV file' }, { status: 500 })
  }
}
