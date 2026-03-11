import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'

describe('database maintenance utilities', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE transactions (id TEXT PRIMARY KEY, account_id TEXT, amount REAL);
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    `)
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('integrity check', () => {
    it('returns ok for a healthy database', () => {
      const results = db.pragma('integrity_check') as Array<{ integrity_check: string }>
      expect(results).toHaveLength(1)
      expect(results[0].integrity_check).toBe('ok')
    })

    it('returns ok after inserting data', () => {
      db.prepare("INSERT INTO accounts (id, name) VALUES ('a1', 'Checking')").run()
      db.prepare("INSERT INTO transactions (id, account_id, amount) VALUES ('t1', 'a1', -50.25)").run()
      const results = db.pragma('integrity_check') as Array<{ integrity_check: string }>
      expect(results[0].integrity_check).toBe('ok')
    })
  })

  describe('WAL checkpoint', () => {
    it('executes wal_checkpoint without error', () => {
      db.prepare("INSERT INTO accounts (id, name) VALUES ('a1', 'Test')").run()
      const result = db.pragma('wal_checkpoint(RESTART)') as Array<{ busy: number; log: number; checkpointed: number }>
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('busy')
      expect(result[0]).toHaveProperty('log')
      expect(result[0]).toHaveProperty('checkpointed')
    })
  })

  describe('VACUUM', () => {
    it('executes vacuum without error', () => {
      db.prepare("INSERT INTO accounts (id, name) VALUES ('a1', 'Test')").run()
      db.prepare("DELETE FROM accounts WHERE id = 'a1'").run()
      expect(() => db.exec('VACUUM')).not.toThrow()
    })
  })

  describe('backup validation', () => {
    it('validates that required tables exist', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      const tableNames = tables.map(t => t.name)
      expect(tableNames).toContain('accounts')
      expect(tableNames).toContain('transactions')
      expect(tableNames).toContain('categories')
    })

    it('detects missing tables in an invalid database', () => {
      const emptyDb = new Database(':memory:')
      emptyDb.exec("CREATE TABLE other (id TEXT)")
      const tables = emptyDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      const tableNames = tables.map(t => t.name)
      const requiredTables = ['accounts', 'transactions', 'categories']
      const missing = requiredTables.filter(t => !tableNames.includes(t))
      expect(missing).toEqual(['accounts', 'transactions', 'categories'])
      emptyDb.close()
    })

    it('accepts a valid CashFlow database copy', () => {
      db.prepare("INSERT INTO accounts (id, name) VALUES ('a1', 'Checking')").run()
      db.prepare("INSERT INTO categories (id, name) VALUES ('c1', 'Food')").run()

      // Simulate validation: check integrity and tables
      const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>
      expect(integrity[0].integrity_check).toBe('ok')

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      const tableNames = tables.map(t => t.name)
      expect(tableNames).toContain('accounts')
      expect(tableNames).toContain('transactions')
      expect(tableNames).toContain('categories')
    })
  })
})
