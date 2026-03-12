import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { safeParseJSON } from '../utils'

const rulesEngineSource = readFileSync(
  join(__dirname, '../rules-engine.ts'),
  'utf-8'
)

const rulesRouteSource = readFileSync(
  join(__dirname, '../../app/api/rules/route.ts'),
  'utf-8'
)

const utilsSource = readFileSync(
  join(__dirname, '../utils.ts'),
  'utf-8'
)

describe('safeParseJSON utility', () => {
  it('parses valid JSON', () => {
    expect(safeParseJSON('[1,2,3]')).toEqual([1, 2, 3])
    expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 })
  })

  it('returns fallback for malformed JSON', () => {
    expect(safeParseJSON('not json')).toEqual([])
    expect(safeParseJSON('{broken', ['default'])).toEqual(['default'])
  })

  it('returns fallback for empty string', () => {
    expect(safeParseJSON('')).toEqual([])
  })

  it('is exported from utils.ts', () => {
    expect(utilsSource).toContain('export function safeParseJSON')
  })
})

describe('rules-engine.ts uses safeParseJSON', () => {
  it('imports safeParseJSON from utils', () => {
    expect(rulesEngineSource).toContain("import { safeParseJSON } from './utils'")
  })

  it('does not use raw JSON.parse for conditions/actions', () => {
    expect(rulesEngineSource).not.toContain('JSON.parse(rule.conditions')
    expect(rulesEngineSource).not.toContain('JSON.parse(rule.actions')
  })

  it('uses safeParseJSON for conditions and actions', () => {
    expect(rulesEngineSource).toContain('safeParseJSON(rule.conditions')
    expect(rulesEngineSource).toContain('safeParseJSON(rule.actions')
  })

  it('filters out rules with invalid parsed data', () => {
    expect(rulesEngineSource).toContain('validRules')
    expect(rulesEngineSource).toContain('Array.isArray(r.conditions)')
    expect(rulesEngineSource).toContain('Array.isArray(r.actions)')
  })
})

describe('rules route uses shared safeParseJSON', () => {
  it('imports safeParseJSON from @/lib/utils', () => {
    expect(rulesRouteSource).toContain("import { safeParseJSON } from '@/lib/utils'")
  })

  it('does not define its own safeParseJSON', () => {
    expect(rulesRouteSource).not.toContain('function safeParseJSON')
  })
})
