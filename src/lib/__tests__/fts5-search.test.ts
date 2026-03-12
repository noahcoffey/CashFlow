import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const dbSource = readFileSync(
  join(__dirname, '../db.ts'),
  'utf-8'
)

const filtersSource = readFileSync(
  join(__dirname, '../transaction-filters.ts'),
  'utf-8'
)

describe('FTS5 transaction search index', () => {
  it('creates FTS5 virtual table for transactions', () => {
    expect(dbSource).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS transactions_fts USING fts5')
  })

  it('indexes raw_description, display_name, and notes', () => {
    expect(dbSource).toContain("content='transactions'")
    expect(dbSource).toContain('raw_description')
    expect(dbSource).toContain('display_name')
    expect(dbSource).toContain('notes')
  })

  it('has INSERT trigger to sync FTS on new transactions', () => {
    expect(dbSource).toContain('CREATE TRIGGER IF NOT EXISTS transactions_ai AFTER INSERT ON transactions')
  })

  it('has DELETE trigger to sync FTS on removed transactions', () => {
    expect(dbSource).toContain('CREATE TRIGGER IF NOT EXISTS transactions_ad AFTER DELETE ON transactions')
  })

  it('has UPDATE trigger to sync FTS on modified transactions', () => {
    expect(dbSource).toContain('CREATE TRIGGER IF NOT EXISTS transactions_au AFTER UPDATE ON transactions')
  })

  it('rebuilds FTS index for existing data on init', () => {
    expect(dbSource).toContain("INSERT INTO transactions_fts(transactions_fts) VALUES('rebuild')")
  })
})

describe('Transaction filters use FTS5', () => {
  it('uses FTS5 MATCH instead of LIKE for search', () => {
    expect(filtersSource).toContain('transactions_fts MATCH')
    expect(filtersSource).not.toContain('LIKE ?')
  })

  it('escapes double quotes in search terms', () => {
    expect(filtersSource).toContain('replace(/"/g, \'""\')')
  })
})
