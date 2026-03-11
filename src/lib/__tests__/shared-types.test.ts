import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const typesSource = fs.readFileSync(
  path.resolve(__dirname, '../types.ts'),
  'utf-8'
)

describe('shared API types', () => {
  it('exports Account interface', () => {
    expect(typesSource).toContain('export interface Account')
  })

  it('exports Category interface', () => {
    expect(typesSource).toContain('export interface Category')
  })

  it('exports Transaction interface', () => {
    expect(typesSource).toContain('export interface Transaction')
  })

  it('exports TransactionWithDetails extending Transaction', () => {
    expect(typesSource).toContain('export interface TransactionWithDetails extends Transaction')
  })

  it('exports Tag interface', () => {
    expect(typesSource).toContain('export interface Tag')
  })

  it('exports PaginatedResponse generic', () => {
    expect(typesSource).toContain('export interface PaginatedResponse<T>')
  })

  it('exports TransactionsResponse type', () => {
    expect(typesSource).toContain('export type TransactionsResponse')
  })

  it('exports report types', () => {
    expect(typesSource).toContain('export interface SpendingByCategoryItem')
    expect(typesSource).toContain('export interface MonthlyTrendMonth')
    expect(typesSource).toContain('export interface IncomeVsExpensesMonth')
    expect(typesSource).toContain('export interface NetWorthMonth')
    expect(typesSource).toContain('export interface YearOverYearData')
    expect(typesSource).toContain('export type ReportResponse')
  })

  it('exports DashboardData interface', () => {
    expect(typesSource).toContain('export interface DashboardData')
  })

  it('exports BudgetItem and BudgetsResponse', () => {
    expect(typesSource).toContain('export interface BudgetItem')
    expect(typesSource).toContain('export interface BudgetsResponse')
  })
})

describe('reports page eliminates any usage', () => {
  const reportsSource = fs.readFileSync(
    path.resolve(__dirname, '../../app/reports/page.tsx'),
    'utf-8'
  )

  it('imports ReportResponse from shared types', () => {
    expect(reportsSource).toContain("import type { ReportResponse")
  })

  it('uses ReportResponse type for rawData state', () => {
    expect(reportsSource).toContain('useState<ReportResponse | null>')
  })

  it('does not use any for rawData state', () => {
    expect(reportsSource).not.toContain('useState<any>')
  })
})

describe('transactions page eliminates any in splits', () => {
  const txnSource = fs.readFileSync(
    path.resolve(__dirname, '../../app/transactions/page.tsx'),
    'utf-8'
  )

  it('does not use (s: any) for split mapping', () => {
    expect(txnSource).not.toContain('(s: any)')
  })
})
