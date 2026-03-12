import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const files = {
  insights: readFileSync(join(__dirname, '../../app/insights/page.tsx'), 'utf-8'),
  budgetSuggestions: readFileSync(join(__dirname, '../../app/api/ai/budget-suggestions/route.ts'), 'utf-8'),
  suggestAliases: readFileSync(join(__dirname, '../../app/api/ai/suggest-aliases/route.ts'), 'utf-8'),
  anomalies: readFileSync(join(__dirname, '../../app/api/ai/anomalies/route.ts'), 'utf-8'),
}

describe('Replace error: any with error: unknown', () => {
  for (const [name, source] of Object.entries(files)) {
    it(`${name} does not use error: any or e: any`, () => {
      expect(source).not.toContain(': any)')
    })

    it(`${name} uses instanceof Error guard`, () => {
      expect(source).toContain('instanceof Error')
    })
  }

  it('insights uses error: unknown for both catch blocks', () => {
    const matches = files.insights.match(/catch \(e: unknown\)/g)
    expect(matches).toHaveLength(2)
  })

  it('AI routes use error: unknown', () => {
    expect(files.budgetSuggestions).toContain('catch (error: unknown)')
    expect(files.suggestAliases).toContain('catch (error: unknown)')
    expect(files.anomalies).toContain('catch (error: unknown)')
  })
})
