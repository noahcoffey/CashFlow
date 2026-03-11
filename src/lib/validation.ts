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
