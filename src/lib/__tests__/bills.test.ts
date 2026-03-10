import { describe, it, expect } from 'vitest'

// Test the bill-related logic: frequency multipliers and paid status matching

describe('bill monthly cost calculation', () => {
  const multiplier: Record<string, number> = {
    weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 0.33, annual: 0.083
  }

  it('calculates weekly bill monthly cost', () => {
    const amount = 10
    expect(Math.abs(amount) * multiplier['weekly']).toBeCloseTo(43.3, 1)
  })

  it('calculates biweekly bill monthly cost', () => {
    const amount = 100
    expect(Math.abs(amount) * multiplier['biweekly']).toBeCloseTo(217, 0)
  })

  it('calculates monthly bill monthly cost', () => {
    const amount = 50
    expect(Math.abs(amount) * multiplier['monthly']).toBe(50)
  })

  it('calculates quarterly bill monthly cost', () => {
    const amount = 300
    expect(Math.abs(amount) * multiplier['quarterly']).toBeCloseTo(99, 0)
  })

  it('calculates annual bill monthly cost', () => {
    const amount = 120
    expect(Math.abs(amount) * multiplier['annual']).toBeCloseTo(9.96, 1)
  })

  it('sums total monthly across mixed frequencies', () => {
    const bills = [
      { amount: -15, frequency: 'monthly' },
      { amount: -100, frequency: 'annual' },
      { amount: -50, frequency: 'weekly' },
    ]
    const total = bills.reduce((sum, b) => {
      return sum + Math.abs(b.amount) * (multiplier[b.frequency] || 1)
    }, 0)
    // 15*1 + 100*0.083 + 50*4.33 = 15 + 8.3 + 216.5 = 239.8
    expect(total).toBeCloseTo(239.8, 0)
  })
})

describe('bill overdue detection', () => {
  it('marks bill as overdue when next_due_date is in the past', () => {
    const today = '2026-03-09'
    const bill = { next_due_date: '2026-03-01' }
    expect(bill.next_due_date < today).toBe(true)
  })

  it('does not mark future bill as overdue', () => {
    const today = '2026-03-09'
    const bill = { next_due_date: '2026-03-15' }
    expect(bill.next_due_date < today).toBe(false)
  })

  it('does not mark today as overdue', () => {
    const today = '2026-03-09'
    const bill = { next_due_date: '2026-03-09' }
    expect(bill.next_due_date < today).toBe(false)
  })
})

describe('bill due this month detection', () => {
  it('detects bill due this month', () => {
    const monthStart = '2026-03-01'
    const monthEnd = '2026-03-31'
    const bill = { next_due_date: '2026-03-15' }
    const isDue = bill.next_due_date >= monthStart && bill.next_due_date <= monthEnd
    expect(isDue).toBe(true)
  })

  it('does not flag bill due next month', () => {
    const monthStart = '2026-03-01'
    const monthEnd = '2026-03-31'
    const bill = { next_due_date: '2026-04-15' }
    const isDue = bill.next_due_date >= monthStart && bill.next_due_date <= monthEnd
    expect(isDue).toBe(false)
  })
})

describe('paid matching logic', () => {
  it('matches transaction amount within $1 tolerance', () => {
    const billAmount = -49.99
    const txAmount = -50.00
    expect(Math.abs(txAmount - billAmount) < 1).toBe(true)
  })

  it('rejects transaction amount outside $1 tolerance', () => {
    const billAmount = -49.99
    const txAmount = -55.00
    expect(Math.abs(txAmount - billAmount) < 1).toBe(false)
  })
})
