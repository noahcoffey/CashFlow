/**
 * Shared helper for matching bills against monthly transactions.
 * Used by GET /api/bills and tested directly.
 */

export interface BillRecord {
  id: string
  name: string
  amount: number
  next_due_date: string
}

export interface TransactionRecord {
  id: string
  amount: number
  display_name: string
  raw_description: string
}

/**
 * Checks if a transaction matches a bill based on:
 * - Amount within $1 tolerance
 * - Bill name appears in display_name or raw_description (case-insensitive)
 */
export function transactionMatchesBill(
  txn: TransactionRecord,
  bill: BillRecord
): boolean {
  return (
    Math.abs(txn.amount - bill.amount) < 1 &&
    (txn.display_name.toLowerCase().includes(bill.name.toLowerCase()) ||
     txn.raw_description.toLowerCase().includes(bill.name.toLowerCase()))
  )
}

/**
 * Given a list of bills and monthly transactions, returns bills annotated
 * with payment status (isPaid, isDue, isOverdue).
 */
export function matchBillPayments<T extends BillRecord>(
  bills: T[],
  monthlyTransactions: TransactionRecord[],
  monthStart: string,
  monthEnd: string,
  today: string
): Array<T & { isPaid: boolean; isDue: boolean; isOverdue: boolean }> {
  return bills.map(bill => {
    const match = monthlyTransactions.find(t => transactionMatchesBill(t, bill))
    return {
      ...bill,
      isPaid: !!match,
      isDue: bill.next_due_date >= monthStart && bill.next_due_date <= monthEnd,
      isOverdue: bill.next_due_date < today,
    }
  })
}
