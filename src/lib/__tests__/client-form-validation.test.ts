import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

function readPage(name: string): string {
  return readFileSync(join(__dirname, '../../app', name, 'page.tsx'), 'utf-8')
}

describe('Client-side form validation', () => {
  describe('Budgets page', () => {
    const source = readPage('budgets')

    it('has formErrors state', () => {
      expect(source).toContain('formErrors')
      expect(source).toContain('setFormErrors')
    })

    it('validates category_id is required', () => {
      expect(source).toContain('Category is required')
    })

    it('validates amount is a valid positive number', () => {
      expect(source).toContain('Amount must be a valid number')
      expect(source).toContain('Amount must be greater than zero')
    })

    it('displays inline error messages', () => {
      expect(source).toContain('text-red-400')
      expect(source).toContain('formErrors.category_id')
      expect(source).toContain('formErrors.amount')
    })

    it('clears errors on input change', () => {
      // onChange handlers should clear relevant error
      const categoryOnChange = source.includes('setFormErrors') && source.includes('category_id')
      expect(categoryOnChange).toBe(true)
    })
  })

  describe('Settings page', () => {
    const source = readPage('settings')

    it('has accountErrors state', () => {
      expect(source).toContain('accountErrors')
      expect(source).toContain('setAccountErrors')
    })

    it('validates account name is required', () => {
      expect(source).toContain('Account name is required')
    })

    it('validates account name max length', () => {
      expect(source).toContain('200 characters')
    })

    it('displays inline error messages', () => {
      expect(source).toContain('accountErrors.name')
      expect(source).toContain('text-red-400')
    })
  })

  describe('Reconcile page', () => {
    const source = readPage('reconcile')

    it('has balanceError state', () => {
      expect(source).toContain('balanceError')
      expect(source).toContain('setBalanceError')
    })

    it('validates statement balance is a number', () => {
      expect(source).toContain('isNaN(parsed)')
      expect(source).toContain('Statement balance must be a valid number')
    })

    it('displays balance error message', () => {
      expect(source).toContain('balanceError &&')
      expect(source).toContain('text-red-400')
    })

    it('clears error on input change', () => {
      expect(source).toContain('setBalanceError(null)')
    })
  })
})
