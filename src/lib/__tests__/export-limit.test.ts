import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { MAX_EXPORT_SIZE } from '../constants'

const exportSource = readFileSync(
  join(__dirname, '../../app/api/transactions/export/route.ts'),
  'utf-8'
)

describe('Transaction export row limit', () => {
  it('MAX_EXPORT_SIZE is a reasonable positive number', () => {
    expect(MAX_EXPORT_SIZE).toBe(10000)
    expect(MAX_EXPORT_SIZE).toBeGreaterThan(0)
  })

  it('export route imports MAX_EXPORT_SIZE from constants', () => {
    expect(exportSource).toContain("import { MAX_EXPORT_SIZE } from '@/lib/constants'")
  })

  it('export route checks count before querying', () => {
    expect(exportSource).toContain('countResult.total > MAX_EXPORT_SIZE')
  })

  it('export route returns 400 when limit exceeded', () => {
    expect(exportSource).toContain('Export limited to')
    expect(exportSource).toContain('please narrow your filters')
    expect(exportSource).toContain('status: 400')
  })

  it('export route applies LIMIT to the query', () => {
    expect(exportSource).toContain('LIMIT ?')
    expect(exportSource).toContain('MAX_EXPORT_SIZE')
  })
})
