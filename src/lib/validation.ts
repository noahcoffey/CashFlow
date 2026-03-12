import { z } from 'zod'

// Reusable primitives
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
const currencyAmount = z.number().finite('Amount must be a finite number')
const uuid = z.string().min(1, 'ID is required')

// Account schemas
export const createAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(200),
  type: z.enum(['checking', 'savings', 'credit', 'investment'], {
    message: 'Type must be checking, savings, credit, or investment',
  }),
  institution: z.string().max(200).default(''),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).default('USD'),
})

export const updateAccountSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['checking', 'savings', 'credit', 'investment']).optional(),
  institution: z.string().max(200).optional(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).optional(),
})

export const deleteAccountSchema = z.object({
  id: uuid,
})

// Transaction schemas
export const createTransactionSchema = z.object({
  account_id: uuid,
  date: dateString,
  amount: currencyAmount,
  raw_description: z.string().min(1, 'Description is required').max(500),
  display_name: z.string().max(500).default(''),
  category_id: z.string().nullable().optional(),
  notes: z.string().max(2000).default(''),
})

export const updateTransactionSchema = z.object({
  id: uuid,
  account_id: z.string().optional(),
  date: dateString.optional(),
  amount: currencyAmount.optional(),
  raw_description: z.string().min(1).max(500).optional(),
  display_name: z.string().max(500).nullable().optional(),
  category_id: z.string().nullable().optional(),
  is_reconciled: z.union([z.literal(0), z.literal(1)]).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const deleteTransactionSchema = z.object({
  id: uuid,
})

// Budget schemas
export const createBudgetSchema = z.object({
  category_id: uuid,
  amount: currencyAmount.nonnegative('Budget amount must be non-negative'),
  period: z.enum(['monthly', 'weekly', 'annual'], {
    message: 'Period must be monthly, weekly, or annual',
  }),
  start_date: dateString.nullable().optional(),
  end_date: dateString.nullable().optional(),
})

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200),
  type: z.enum(['income', 'expense', 'transfer'], {
    message: 'Type must be income, expense, or transfer',
  }),
  parent_id: z.string().nullable().optional(),
  color: z.string().max(20).default('#6B7280'),
  icon: z.string().max(10).default('📁'),
  budget_amount: z.number().nonnegative().default(0),
  budget_period: z.enum(['monthly', 'weekly', 'annual'], {
    message: 'Period must be monthly, weekly, or annual',
  }).default('monthly'),
})

export const updateCategorySchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  parent_id: z.string().nullable().optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(10).optional(),
  budget_amount: z.number().nonnegative().optional(),
  budget_period: z.enum(['monthly', 'weekly', 'annual']).optional(),
})

export const deleteCategorySchema = z.object({
  id: uuid,
})

// Bill schemas
export const createBillSchema = z.object({
  name: z.string().min(1, 'Bill name is required').max(200),
  amount: currencyAmount,
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'], {
    message: 'Frequency must be weekly, biweekly, monthly, quarterly, or annual',
  }),
  next_due_date: dateString,
  category_id: z.string().nullable().optional(),
  account_id: z.string().nullable().optional(),
})

export const updateBillSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  amount: currencyAmount.optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']).optional(),
  next_due_date: dateString.optional(),
  category_id: z.string().nullable().optional(),
  account_id: z.string().nullable().optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
})

export const deleteBillSchema = z.object({
  id: uuid,
})

// Tag schemas
export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100),
  color: z.string().max(20).default('#6B7280'),
})

export const updateTagSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional(),
})

export const deleteTagSchema = z.object({
  id: uuid,
})

// Alias schemas
export const createAliasSchema = z.object({
  raw_pattern: z.string().min(1, 'Match pattern is required').max(500),
  display_name: z.string().min(1, 'Display name is required').max(500),
  category_id: z.string().nullable().optional(),
  apply_retroactively: z.boolean().optional(),
})

export const updateAliasSchema = z.object({
  id: uuid,
  raw_pattern: z.string().min(1).max(500).optional(),
  display_name: z.string().min(1).max(500).optional(),
  category_id: z.string().nullable().optional(),
})

export const deleteAliasSchema = z.object({
  id: uuid,
})

// Import schemas
const importTransactionSchema = z.object({
  date: z.string().min(1, 'Transaction date is required'),
  amount: z.number().finite('Amount must be a finite number'),
  raw_description: z.string().min(1, 'Description is required'),
})

export const importBodySchema = z.object({
  accountId: uuid,
  transactions: z.array(importTransactionSchema)
    .min(1, 'At least one transaction is required')
    .max(5000, 'Import limited to 5000 transactions per request'),
})

// AI query schema
export const aiQuerySchema = z.object({
  question: z.string().min(1, 'A question is required').max(2000),
})

// AI forecast response schema
export const aiForecastItemSchema = z.object({
  category: z.string(),
  projected_amount: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
})

export const aiForecastResponseSchema = z.array(aiForecastItemSchema)

// Reconciliation schemas
export const createReconciliationSchema = z.object({
  account_id: uuid,
  statement_date: dateString,
  statement_balance: currencyAmount,
})

export const completeReconciliationSchema = z.object({
  status: z.enum(['in_progress', 'completed'], {
    message: 'Status must be in_progress or completed',
  }).default('completed'),
  clearedIds: z.array(z.string().min(1)).optional(),
})

/**
 * Validate request body against a Zod schema.
 * Returns { data } on success or { error, status } on failure.
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  | { success: true; data: T }
  | { success: false; error: string; status: 400 } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const messages = result.error.issues.map(i => i.message).join('; ')
    return { success: false, error: messages, status: 400 }
  }
  return { success: true, data: result.data }
}
