import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
  createAliasSchema,
  updateAliasSchema,
  deleteAliasSchema,
  validateBody,
} from '../validation'

// --- Tag schema tests ---
describe('createTagSchema', () => {
  it('accepts valid tag with defaults', () => {
    const result = createTagSchema.safeParse({ name: 'Groceries' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color).toBe('#6B7280')
    }
  })

  it('accepts tag with custom color', () => {
    const result = createTagSchema.safeParse({ name: 'Travel', color: '#FF0000' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createTagSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createTagSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects name over 100 chars', () => {
    const result = createTagSchema.safeParse({ name: 'x'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('updateTagSchema', () => {
  it('requires id', () => {
    const result = updateTagSchema.safeParse({ name: 'New' })
    expect(result.success).toBe(false)
  })

  it('accepts id with optional fields', () => {
    const result = updateTagSchema.safeParse({ id: 'abc-123' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update', () => {
    const result = updateTagSchema.safeParse({ id: 'abc-123', color: '#00FF00' })
    expect(result.success).toBe(true)
  })
})

describe('deleteTagSchema', () => {
  it('requires id', () => {
    const result = deleteTagSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts valid id', () => {
    const result = deleteTagSchema.safeParse({ id: 'abc-123' })
    expect(result.success).toBe(true)
  })
})

// --- Alias schema tests ---
describe('createAliasSchema', () => {
  it('accepts valid alias', () => {
    const result = createAliasSchema.safeParse({
      raw_pattern: 'AMZN*',
      display_name: 'Amazon',
    })
    expect(result.success).toBe(true)
  })

  it('accepts alias with category and retroactive flag', () => {
    const result = createAliasSchema.safeParse({
      raw_pattern: 'SPOTIFY',
      display_name: 'Spotify',
      category_id: 'cat-1',
      apply_retroactively: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing raw_pattern', () => {
    const result = createAliasSchema.safeParse({ display_name: 'Amazon' })
    expect(result.success).toBe(false)
  })

  it('rejects missing display_name', () => {
    const result = createAliasSchema.safeParse({ raw_pattern: 'AMZN*' })
    expect(result.success).toBe(false)
  })

  it('rejects empty raw_pattern', () => {
    const result = createAliasSchema.safeParse({ raw_pattern: '', display_name: 'Amazon' })
    expect(result.success).toBe(false)
  })
})

describe('updateAliasSchema', () => {
  it('requires id', () => {
    const result = updateAliasSchema.safeParse({ raw_pattern: 'NEW*' })
    expect(result.success).toBe(false)
  })

  it('accepts id with optional fields', () => {
    const result = updateAliasSchema.safeParse({ id: 'alias-1' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update', () => {
    const result = updateAliasSchema.safeParse({ id: 'alias-1', display_name: 'Updated' })
    expect(result.success).toBe(true)
  })

  it('accepts nullable category_id', () => {
    const result = updateAliasSchema.safeParse({ id: 'alias-1', category_id: null })
    expect(result.success).toBe(true)
  })
})

describe('deleteAliasSchema', () => {
  it('requires id', () => {
    const result = deleteAliasSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts valid id', () => {
    const result = deleteAliasSchema.safeParse({ id: 'alias-1' })
    expect(result.success).toBe(true)
  })
})

// --- validateBody integration ---
describe('validateBody with tag/alias schemas', () => {
  it('returns success with parsed data for valid tag', () => {
    const result = validateBody(createTagSchema, { name: 'Test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Test')
      expect(result.data.color).toBe('#6B7280')
    }
  })

  it('returns error string for invalid tag', () => {
    const result = validateBody(createTagSchema, {})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(400)
      expect(result.error).toBeTruthy()
    }
  })
})

// --- Route source verification ---
describe('routes use validateBody (not manual checks)', () => {
  const tagsSource = readFileSync(
    join(__dirname, '../../app/api/tags/route.ts'),
    'utf-8'
  )
  const aliasesSource = readFileSync(
    join(__dirname, '../../app/api/aliases/route.ts'),
    'utf-8'
  )

  it('tags route imports validateBody and schemas', () => {
    expect(tagsSource).toContain('validateBody')
    expect(tagsSource).toContain('createTagSchema')
    expect(tagsSource).toContain('updateTagSchema')
    expect(tagsSource).toContain('deleteTagSchema')
  })

  it('tags route does not use manual validation', () => {
    expect(tagsSource).not.toMatch(/if\s*\(\s*!name\s*\)/)
    expect(tagsSource).not.toMatch(/if\s*\(\s*!id\s*\)/)
  })

  it('tags route does not use error: any', () => {
    expect(tagsSource).not.toContain('error: any')
  })

  it('tags route preserves UNIQUE constraint handling', () => {
    expect(tagsSource).toContain('UNIQUE constraint')
    expect(tagsSource).toContain('status: 409')
  })

  it('aliases route imports validateBody and schemas', () => {
    expect(aliasesSource).toContain('validateBody')
    expect(aliasesSource).toContain('createAliasSchema')
    expect(aliasesSource).toContain('updateAliasSchema')
    expect(aliasesSource).toContain('deleteAliasSchema')
  })

  it('aliases route does not use manual validation', () => {
    expect(aliasesSource).not.toMatch(/if\s*\(\s*!raw_pattern/)
    expect(aliasesSource).not.toMatch(/if\s*\(\s*!id\s*\)/)
  })

  it('aliases route preserves retroactive application', () => {
    expect(aliasesSource).toContain('apply_retroactively')
    expect(aliasesSource).toContain('applyAliasesToTransactions')
  })
})
