import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const dashboardRouteSource = readFileSync(
  join(__dirname, '../../app/api/dashboard/route.ts'),
  'utf-8'
)

const dashboardPageSource = readFileSync(
  join(__dirname, '../../app/dashboard/page.tsx'),
  'utf-8'
)

describe('Dashboard API uncategorized count', () => {
  it('queries for uncategorized transactions', () => {
    expect(dashboardRouteSource).toContain('category_id IS NULL')
  })

  it('includes uncategorizedCount in response', () => {
    expect(dashboardRouteSource).toContain('uncategorizedCount')
  })
})

describe('Dashboard page uncategorized badge', () => {
  it('has uncategorizedCount in DashboardData interface', () => {
    expect(dashboardPageSource).toContain('uncategorizedCount: number')
  })

  it('conditionally renders badge when count > 0', () => {
    expect(dashboardPageSource).toContain('data.uncategorizedCount > 0')
  })

  it('links to transactions page filtered to uncategorized', () => {
    expect(dashboardPageSource).toContain('/transactions?category=uncategorized')
  })

  it('displays the uncategorized count in the badge', () => {
    expect(dashboardPageSource).toContain('data.uncategorizedCount')
    expect(dashboardPageSource).toContain('uncategorized')
  })

  it('uses AlertCircle icon in the badge', () => {
    expect(dashboardPageSource).toContain('AlertCircle')
  })
})
