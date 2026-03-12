// Shared types for API responses and frontend components

// Base database entities
export interface Account {
  id: string
  name: string
  type: 'checking' | 'savings' | 'credit' | 'investment'
  institution: string
  currency: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  parent_id: string | null
  color: string
  icon: string
  type: 'income' | 'expense' | 'transfer'
  budget_amount: number
  budget_period: string
  created_at: string
}

export interface Transaction {
  id: string
  account_id: string
  date: string
  amount: number
  raw_description: string
  display_name: string
  category_id: string | null
  is_reconciled: number
  notes: string
  created_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
  usage_count?: number
}

export interface AccountWithBalance extends Account {
  balance: number
  transaction_count: number
}

// Joined/enriched types returned by API
export interface TransactionWithDetails extends Transaction {
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  account_name: string | null
  tags?: Array<{ id: string; name: string; color: string }>
}

// API response shapes
export interface PaginatedResponse<T> {
  total: number
  page: number
  limit: number
  totalPages: number
  transactions: T[]
}

export type TransactionsResponse = PaginatedResponse<TransactionWithDetails>

export interface AccountsResponse {
  accounts: Account[]
}

export interface CategoriesResponse {
  categories: Array<Pick<Category, 'id' | 'name' | 'parent_id' | 'color' | 'icon' | 'type'>>
}

export interface TagsResponse {
  tags: Tag[]
}

// Report types
export interface SpendingByCategoryItem {
  id: string
  name: string
  color: string
  icon: string
  total: number
  transaction_count: number
}

export interface MonthlyTrendMonth {
  month: string
  categories: Array<{ id: string; name: string; color: string; total: number }>
}

export interface IncomeVsExpensesMonth {
  month: string
  income: number
  expenses: number
  net: number
}

export interface NetWorthMonth {
  month: string
  balances: Record<string, number>
  total: number
}

export interface YearOverYearData {
  data: Array<Record<string, number | string>>
  years: string[]
  categoryByYear: Array<{
    year: string
    categories: Array<{ name: string; color: string; icon: string; total: number }>
  }>
  yearTotals: Array<{ year: string; expenses: number; income: number }>
}

export type ReportResponse =
  | { data: SpendingByCategoryItem[]; startDate: string; endDate: string }
  | { data: MonthlyTrendMonth[] }
  | { data: IncomeVsExpensesMonth[] }
  | { data: NetWorthMonth[]; accounts: string[] }
  | YearOverYearData

// Dashboard
export interface DashboardData {
  monthlySpending: number
  lastMonthSpending: number
  monthlyIncome: number
  topCategories: Array<{ id: string; name: string; color: string; icon: string; total: number }>
  recentTransactions: TransactionWithDetails[]
  accountBalances: Array<Account & { balance: number }>
  cashFlowByMonth: Array<{ month: string; income: number; expenses: number }>
  budgetUtilization: Array<{
    id: string
    budgeted: number
    period: string
    category_id: string
    category_name: string
    category_color: string
    category_icon: string
    spent: number
  }>
}

// Budget
export interface BudgetItem {
  id: string
  category_id: string
  amount: number
  period: string
  start_date: string | null
  end_date: string | null
  category_name: string
  category_color: string
  category_icon: string
  category_type: string
  spent: number
}

export interface BudgetsResponse {
  budgets: BudgetItem[]
}
