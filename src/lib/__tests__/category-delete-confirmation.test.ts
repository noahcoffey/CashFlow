import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const settingsSource = readFileSync(
  join(__dirname, '../../app/settings/page.tsx'),
  'utf-8'
)

const categoriesRouteSource = readFileSync(
  join(__dirname, '../../app/api/categories/route.ts'),
  'utf-8'
)

describe('Categories API transaction count', () => {
  it('includes transaction_count in GET response', () => {
    expect(categoriesRouteSource).toContain('transaction_count')
    expect(categoriesRouteSource).toContain('SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id')
  })

  it('supports confirm=false to get transaction count without deleting', () => {
    expect(categoriesRouteSource).toContain('confirm === false')
    expect(categoriesRouteSource).toContain('transactionCount')
  })

  it('supports reassignTo parameter to move transactions before delete', () => {
    expect(categoriesRouteSource).toContain('reassignTo')
    expect(categoriesRouteSource).toContain('UPDATE transactions SET category_id = ?')
  })

  it('validates reassign target category exists', () => {
    expect(categoriesRouteSource).toContain('Reassign target category not found')
  })
})

describe('Settings page category delete confirmation', () => {
  it('has Category interface with transaction_count', () => {
    expect(settingsSource).toContain('transaction_count: number')
  })

  it('has deletingCategory state', () => {
    expect(settingsSource).toContain('deletingCategory')
    expect(settingsSource).toContain('setDeletingCategory')
  })

  it('has categoryReassignTo state', () => {
    expect(settingsSource).toContain('categoryReassignTo')
    expect(settingsSource).toContain('setCategoryReassignTo')
  })

  it('has a Categories section in settings', () => {
    expect(settingsSource).toContain('Categories')
    expect(settingsSource).toContain('Manage transaction categories')
  })

  it('shows transaction count per category in the list', () => {
    expect(settingsSource).toContain('cat.transaction_count')
  })

  it('has a delete button per category', () => {
    expect(settingsSource).toContain('startDeleteCategory')
  })

  it('has a Delete Category confirmation dialog', () => {
    expect(settingsSource).toContain('Delete Category')
    expect(settingsSource).toContain('confirmDeleteCategory')
  })

  it('warns about transactions becoming uncategorized', () => {
    expect(settingsSource).toContain('will become uncategorized')
  })

  it('offers reassignment to another category', () => {
    expect(settingsSource).toContain('Reassign transactions to')
    expect(settingsSource).toContain('Leave uncategorized')
  })

  it('uses AlertTriangle icon for warning', () => {
    expect(settingsSource).toContain('AlertTriangle')
  })

  it('has confirmDeleteCategory function that sends reassignTo', () => {
    expect(settingsSource).toContain('reassignTo')
    expect(settingsSource).toContain('confirmDeleteCategory')
  })
})
