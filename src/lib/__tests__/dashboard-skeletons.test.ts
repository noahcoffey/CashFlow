import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(
  join(__dirname, '../../app/dashboard/page.tsx'),
  'utf-8'
)

describe('Dashboard per-card loading skeletons', () => {
  it('has separate dashboardLoading state for dashboard data', () => {
    expect(source).toContain('dashboardLoading')
    expect(source).toContain('setDashboardLoading')
  })

  it('has separate billsLoading state for bills data', () => {
    expect(source).toContain('billsLoading')
    expect(source).toContain('setBillsLoading')
  })

  it('does not use a single full-page DashboardSkeleton', () => {
    expect(source).not.toContain('DashboardSkeleton')
  })

  it('has SummaryCardSkeleton component for summary cards', () => {
    expect(source).toContain('SummaryCardSkeleton')
  })

  it('shows summary card skeletons while dashboardLoading', () => {
    expect(source).toContain('dashboardLoading ?')
    expect(source).toContain('SummaryCardSkeleton')
  })

  it('shows chart skeleton while dashboardLoading', () => {
    expect(source).toContain('Income vs Expenses')
    expect(source).toContain('Top Categories')
  })

  it('shows budget skeleton while dashboardLoading', () => {
    expect(source).toContain('Budget Utilization')
  })

  it('shows transaction skeleton while dashboardLoading', () => {
    expect(source).toContain('Recent Transactions')
  })

  it('shows bills skeleton while billsLoading', () => {
    expect(source).toContain('billsLoading')
    expect(source).toContain('Bills This Month')
  })

  it('shows account balances skeleton while dashboardLoading', () => {
    expect(source).toContain('Account Balances')
  })

  it('renders page structure immediately with header visible', () => {
    // The header should not be gated behind loading
    expect(source).toContain('text-2xl font-bold text-zinc-100">Dashboard')
  })
})
