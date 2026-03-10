/**
 * Seed the database with realistic demo data for screenshots.
 * Run: npx tsx scripts/seed-demo.ts
 */
import { randomUUID } from 'crypto'
import { getDb } from '../src/lib/db'

const db = getDb()

// Check if demo data already exists
const existing = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE name = 'Chase Checking'").get() as any
if (existing.count > 0) {
  console.log('Demo data already exists. Delete cashflow.db and restart the app first if you want fresh data.')
  process.exit(0)
}

const acctChecking = randomUUID()
const acctCredit = randomUUID()
const acctSavings = randomUUID()

// Create accounts
const insertAccount = db.prepare('INSERT INTO accounts (id, name, type, institution, currency) VALUES (?, ?, ?, ?, ?)')
insertAccount.run(acctChecking, 'Chase Checking', 'checking', 'JPMorgan Chase', 'USD')
insertAccount.run(acctCredit, 'Amex Gold', 'credit', 'American Express', 'USD')
insertAccount.run(acctSavings, 'Ally Savings', 'savings', 'Ally Bank', 'USD')

// Transaction templates per category
const templates: { desc: string; display: string; cat: string; min: number; max: number; account?: string }[] = [
  // Groceries
  { desc: 'WHOLE FOODS MKT #10234', display: 'Whole Foods', cat: 'cat-groceries', min: 35, max: 120 },
  { desc: 'TRADER JOES #511', display: "Trader Joe's", cat: 'cat-groceries', min: 25, max: 85 },
  { desc: 'KROGER STORE #4402', display: 'Kroger', cat: 'cat-groceries', min: 40, max: 150 },
  { desc: 'COSTCO WHSE #1142', display: 'Costco', cat: 'cat-groceries', min: 80, max: 250 },
  // Restaurants
  { desc: 'STARBUCKS STORE #8832', display: 'Starbucks', cat: 'cat-restaurants', min: 4, max: 12 },
  { desc: 'CHIPOTLE ONLINE', display: 'Chipotle', cat: 'cat-restaurants', min: 10, max: 18 },
  { desc: 'DOORDASH*THAI BASIL', display: 'DoorDash', cat: 'cat-restaurants', min: 20, max: 45 },
  { desc: 'SQ *LOCAL PIZZA CO', display: 'Local Pizza', cat: 'cat-restaurants', min: 15, max: 35 },
  // Gas
  { desc: 'SHELL OIL 572634891', display: 'Shell', cat: 'cat-gas', min: 35, max: 65 },
  { desc: 'CHEVRON STATION 4421', display: 'Chevron', cat: 'cat-gas', min: 30, max: 60 },
  // Transport
  { desc: 'UBER *TRIP', display: 'Uber', cat: 'cat-transport', min: 8, max: 35 },
  // Housing
  { desc: 'RENT PAYMENT - APT 4B', display: 'Rent', cat: 'cat-rent', min: 1850, max: 1850 },
  // Utilities
  { desc: 'CITY WATER DEPT', display: 'Water Bill', cat: 'cat-utilities', min: 30, max: 55 },
  { desc: 'DUKE ENERGY ONLINE', display: 'Electric Bill', cat: 'cat-utilities', min: 80, max: 180 },
  { desc: 'XFINITY INTERNET', display: 'Xfinity Internet', cat: 'cat-utilities', min: 75, max: 75 },
  // Entertainment
  { desc: 'AMC THEATRES 4819', display: 'AMC Theatres', cat: 'cat-entertainment', min: 12, max: 35 },
  { desc: 'SPOTIFY USA', display: 'Spotify', cat: 'cat-subscriptions', min: 10.99, max: 10.99 },
  { desc: 'NETFLIX.COM', display: 'Netflix', cat: 'cat-subscriptions', min: 15.49, max: 15.49 },
  { desc: 'APPLE.COM/BILL', display: 'Apple iCloud', cat: 'cat-subscriptions', min: 2.99, max: 2.99 },
  // Shopping
  { desc: 'AMAZON.COM*MK2LP94R1', display: 'Amazon', cat: 'cat-shopping', min: 10, max: 120 },
  { desc: 'TARGET STORE #1842', display: 'Target', cat: 'cat-shopping', min: 15, max: 90 },
  // Health
  { desc: 'PLANET FITNESS MONTHLY', display: 'Planet Fitness', cat: 'cat-health', min: 24.99, max: 24.99 },
  { desc: 'CVS PHARMACY #4291', display: 'CVS Pharmacy', cat: 'cat-health', min: 8, max: 45 },
  // Insurance
  { desc: 'GEICO AUTO INS', display: 'Geico Auto', cat: 'cat-insurance', min: 145, max: 145 },
  // Personal
  { desc: 'GREAT CLIPS #2194', display: 'Great Clips', cat: 'cat-personal', min: 18, max: 30 },
  // Gifts
  { desc: 'VENMO PAYMENT', display: 'Venmo', cat: 'cat-gifts', min: 20, max: 75 },
]

const incomeTemplates = [
  { desc: 'PAYROLL - ACME CORP', display: 'Acme Corp Salary', cat: 'cat-salary', amount: 3850 },
  { desc: 'PAYROLL - ACME CORP', display: 'Acme Corp Salary', cat: 'cat-salary', amount: 3850 },
]

function randBetween(min: number, max: number): number {
  if (min === max) return min
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

const insertTxn = db.prepare(
  'INSERT INTO transactions (id, account_id, date, amount, raw_description, display_name, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
)

const seedAll = db.transaction(() => {
  // Generate 6 months of data (Oct 2025 - Mar 2026)
  const months = [
    { year: 2025, month: 10 }, { year: 2025, month: 11 }, { year: 2025, month: 12 },
    { year: 2026, month: 1 }, { year: 2026, month: 2 }, { year: 2026, month: 3 },
  ]

  for (const m of months) {
    const daysInMonth = new Date(m.year, m.month, 0).getDate()
    const monthStr = m.month.toString().padStart(2, '0')
    const isCurrentMonth = m.year === 2026 && m.month === 3

    // Income: 2 paychecks per month (1st and 15th)
    for (const payDay of [1, 15]) {
      if (isCurrentMonth && payDay > 9) continue
      const date = `${m.year}-${monthStr}-${payDay.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctChecking, date, 3850, 'PAYROLL - ACME CORP', 'Acme Corp Salary', 'cat-salary')
    }

    // Savings transfer on the 2nd
    if (!isCurrentMonth || 2 <= 9) {
      const date = `${m.year}-${monthStr}-02`
      insertTxn.run(randomUUID(), acctChecking, date, -500, 'TRANSFER TO SAVINGS', 'Transfer to Savings', 'cat-transfer')
      insertTxn.run(randomUUID(), acctSavings, date, 500, 'TRANSFER FROM CHECKING', 'Transfer from Checking', 'cat-transfer')
    }

    // Rent on the 1st
    if (!isCurrentMonth || 1 <= 9) {
      const date = `${m.year}-${monthStr}-01`
      insertTxn.run(randomUUID(), acctChecking, date, -1850, 'RENT PAYMENT - APT 4B', 'Rent', 'cat-rent')
    }

    // Monthly subscriptions
    const subs = templates.filter(t => t.min === t.max && t.min < 50)
    for (const sub of subs) {
      const day = Math.min(5 + Math.floor(Math.random() * 10), isCurrentMonth ? 9 : daysInMonth)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctCredit, date, -sub.min, sub.desc, sub.display, sub.cat)
    }

    // Insurance (monthly)
    {
      const date = `${m.year}-${monthStr}-${Math.min(12, isCurrentMonth ? 9 : daysInMonth).toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctChecking, date, -145, 'GEICO AUTO INS', 'Geico Auto', 'cat-insurance')
    }

    // Variable spending: groceries, restaurants, gas, shopping, etc.
    const variableTemplates = templates.filter(t => t.min !== t.max)
    const maxDay = isCurrentMonth ? 9 : daysInMonth

    // Groceries: 4-6 trips per month
    const groceryTemplates = variableTemplates.filter(t => t.cat === 'cat-groceries')
    for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
      const t = groceryTemplates[Math.floor(Math.random() * groceryTemplates.length)]
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      const acct = Math.random() > 0.5 ? acctCredit : acctChecking
      insertTxn.run(randomUUID(), acct, date, -randBetween(t.min, t.max), t.desc, t.display, t.cat)
    }

    // Coffee/restaurants: 6-10 per month
    const foodTemplates = variableTemplates.filter(t => t.cat === 'cat-restaurants')
    for (let i = 0; i < 6 + Math.floor(Math.random() * 5); i++) {
      const t = foodTemplates[Math.floor(Math.random() * foodTemplates.length)]
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctCredit, date, -randBetween(t.min, t.max), t.desc, t.display, t.cat)
    }

    // Gas: 2-3 per month
    const gasTemplates = variableTemplates.filter(t => t.cat === 'cat-gas')
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const t = gasTemplates[Math.floor(Math.random() * gasTemplates.length)]
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctChecking, date, -randBetween(t.min, t.max), t.desc, t.display, t.cat)
    }

    // Uber: 1-3 per month
    for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctCredit, date, -randBetween(8, 35), 'UBER *TRIP', 'Uber', 'cat-transport')
    }

    // Shopping: 2-4 per month
    const shopTemplates = variableTemplates.filter(t => t.cat === 'cat-shopping')
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const t = shopTemplates[Math.floor(Math.random() * shopTemplates.length)]
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctCredit, date, -randBetween(t.min, t.max), t.desc, t.display, t.cat)
    }

    // Entertainment: 1-2 per month
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctCredit, date, -randBetween(12, 35), 'AMC THEATRES 4819', 'AMC Theatres', 'cat-entertainment')
    }

    // Health: pharmacy 1-2, gym monthly
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctCredit, date, -randBetween(8, 45), 'CVS PHARMACY #4291', 'CVS Pharmacy', 'cat-health')
    }

    // Utilities (electric varies, water varies)
    {
      const day = Math.min(18, maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctChecking, date, -randBetween(80, 180), 'DUKE ENERGY ONLINE', 'Electric Bill', 'cat-utilities')
    }
    {
      const day = Math.min(22, maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctChecking, date, -randBetween(30, 55), 'CITY WATER DEPT', 'Water Bill', 'cat-utilities')
    }

    // Haircut every other month
    if (m.month % 2 === 0) {
      const day = Math.min(20, maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctChecking, date, -randBetween(18, 30), 'GREAT CLIPS #2194', 'Great Clips', 'cat-personal')
    }

    // Occasional Venmo
    if (Math.random() > 0.4) {
      const day = 1 + Math.floor(Math.random() * maxDay)
      const date = `${m.year}-${monthStr}-${day.toString().padStart(2, '0')}`
      insertTxn.run(randomUUID(), acctChecking, date, -randBetween(20, 75), 'VENMO PAYMENT', 'Venmo', 'cat-gifts')
    }
  }

  // Add some budgets
  const insertBudget = db.prepare('INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)')
  insertBudget.run(randomUUID(), 'cat-groceries', 500, 'monthly')
  insertBudget.run(randomUUID(), 'cat-restaurants', 250, 'monthly')
  insertBudget.run(randomUUID(), 'cat-gas', 150, 'monthly')
  insertBudget.run(randomUUID(), 'cat-shopping', 200, 'monthly')
  insertBudget.run(randomUUID(), 'cat-entertainment', 100, 'monthly')
  insertBudget.run(randomUUID(), 'cat-utilities', 300, 'monthly')
  insertBudget.run(randomUUID(), 'cat-rent', 1900, 'monthly')

  // Add a couple tags
  const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)')
  insertTag.run(randomUUID(), 'tax-deductible', '#22C55E')
  insertTag.run(randomUUID(), 'reimbursable', '#3B82F6')

  // Add a rule
  const insertRule = db.prepare('INSERT INTO categorization_rules (id, name, priority, conditions, actions) VALUES (?, ?, ?, ?, ?)')
  insertRule.run(randomUUID(), 'Coffee shops → Restaurants', 10,
    JSON.stringify([{ field: 'description', operator: 'contains', value: 'STARBUCKS' }]),
    JSON.stringify([{ type: 'set_category', value: 'cat-restaurants' }, { type: 'set_display_name', value: 'Starbucks' }])
  )

  // Add a scheduled bill
  const insertBill = db.prepare('INSERT INTO scheduled_bills (id, name, amount, frequency, next_due_date, is_active) VALUES (?, ?, ?, ?, ?, 1)')
  insertBill.run(randomUUID(), 'Rent', -1850, 'monthly', '2026-04-01')
  insertBill.run(randomUUID(), 'Netflix', -15.49, 'monthly', '2026-03-15')
  insertBill.run(randomUUID(), 'Geico Auto Insurance', -145, 'monthly', '2026-03-12')
})

seedAll()

const txnCount = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as any).c
console.log(`Seeded demo data: ${txnCount} transactions across 3 accounts`)
