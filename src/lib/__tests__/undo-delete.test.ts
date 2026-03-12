import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(
  join(__dirname, '../../app/transactions/page.tsx'),
  'utf-8'
)

describe('Transaction delete undo support', () => {
  it('imports useRef for pending delete tracking', () => {
    expect(source).toContain('useRef')
  })

  it('has a pendingDeleteRef to track pending deletes', () => {
    expect(source).toContain('pendingDeleteRef')
  })

  it('deleteTransaction shows toast with Undo action', () => {
    expect(source).toContain('const deleteTransaction')
    expect(source).toContain('"Undo"')
  })

  it('delays the API call with setTimeout', () => {
    expect(source).toContain('setTimeout')
    expect(source).toContain('5000')
  })

  it('restores transactions on undo click', () => {
    expect(source).toContain('Transaction restored')
  })

  it('clears pending timer on undo', () => {
    expect(source).toContain('clearTimeout')
  })

  it('bulkDelete also shows toast with Undo action', () => {
    expect(source).toContain('const bulkDelete')
    expect(source).toContain('transactions restored')
  })

  it('cancels previous pending delete before starting new one', () => {
    // Both deleteTransaction and bulkDelete should clear pending deletes first
    const deleteBlock = source.slice(
      source.indexOf('const deleteTransaction'),
      source.indexOf('const bulkDelete')
    )
    expect(deleteBlock).toContain('pendingDeleteRef.current')
    expect(deleteBlock).toContain('clearTimeout')
    expect(deleteBlock).toContain('toast.dismiss')
  })

  it('stores both timer and toastId in the ref', () => {
    expect(source).toContain('timer')
    expect(source).toContain('toastId')
  })

  it('sets pendingDeleteRef to null after API call completes', () => {
    expect(source).toContain('pendingDeleteRef.current = null')
  })

  it('falls back to error state if API call fails after timeout', () => {
    expect(source).toContain('Failed to delete transaction')
    expect(source).toContain('Failed to delete transactions')
  })
})
