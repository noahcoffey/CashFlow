import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(
  join(__dirname, '../../app/api/transactions/route.ts'),
  'utf-8'
)

describe('Transactions API tag fetching optimization', () => {
  it('uses json_group_array subquery instead of separate tag query', () => {
    expect(source).toContain('json_group_array')
    expect(source).toContain('json_object')
  })

  it('fetches tags inline with the main transaction query', () => {
    expect(source).toContain('tags_json')
    expect(source).toContain('transaction_tags tt')
  })

  it('does not have a separate tag query with IN clause', () => {
    expect(source).not.toContain('WHERE tt.transaction_id IN')
  })

  it('does not use as any[] casts for transactions', () => {
    expect(source).not.toContain('as any[]')
  })

  it('filters out null tags from json_group_array', () => {
    // json_group_array returns [{"id":null,...}] when no tags — filter those
    expect(source).toContain('t.id !== null')
  })

  it('parses tags_json and destructures it from the result', () => {
    expect(source).toContain('JSON.parse(tags_json)')
    expect(source).toContain('tags_json, ...rest')
  })
})
