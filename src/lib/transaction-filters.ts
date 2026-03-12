/**
 * Shared transaction filter builder used by both the transactions GET
 * and export routes to avoid duplicating filter logic.
 */
export function buildTransactionFilters(searchParams: URLSearchParams): {
  whereClause: string
  params: (string | number)[]
} {
  const conditions: string[] = []
  const params: (string | number)[] = []

  const search = searchParams.get('search')
  if (search) {
    // Use FTS5 for fast full-text search; escape double quotes in search term
    const escaped = search.replace(/"/g, '""')
    conditions.push('t.rowid IN (SELECT rowid FROM transactions_fts WHERE transactions_fts MATCH ?)')
    params.push(`"${escaped}"`)
  }

  const accountId = searchParams.get('accountId')
  if (accountId) {
    conditions.push('t.account_id = ?')
    params.push(accountId)
  }

  const categoryId = searchParams.get('categoryId')
  if (categoryId) {
    conditions.push('t.category_id = ?')
    params.push(categoryId)
  }

  const startDate = searchParams.get('startDate')
  if (startDate) {
    conditions.push('t.date >= ?')
    params.push(startDate)
  }

  const endDate = searchParams.get('endDate')
  if (endDate) {
    conditions.push('t.date <= ?')
    params.push(endDate)
  }

  const isReconciled = searchParams.get('isReconciled')
  if (isReconciled !== null && isReconciled !== undefined && isReconciled !== '') {
    conditions.push('t.is_reconciled = ?')
    params.push(isReconciled === 'true' ? 1 : 0)
  }

  const minAmount = searchParams.get('minAmount')
  if (minAmount) {
    conditions.push('t.amount >= ?')
    params.push(parseFloat(minAmount))
  }

  const maxAmount = searchParams.get('maxAmount')
  if (maxAmount) {
    conditions.push('t.amount <= ?')
    params.push(parseFloat(maxAmount))
  }

  const tagId = searchParams.get('tagId')
  if (tagId) {
    conditions.push('t.id IN (SELECT transaction_id FROM transaction_tags WHERE tag_id = ?)')
    params.push(tagId)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return { whereClause, params }
}
