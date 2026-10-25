const SYMBOLS: Record<string, string> = { AUD: 'A$', NZD: 'NZ$' }

/** Local-currency price: "A$6,480", "NZ$5,920", "A$18.50". Other codes render as "THB 100". */
export function formatMoney(amount: number, currency: string): string {
  const digits = Number.isInteger(amount) ? 0 : 2
  const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
  const symbol = SYMBOLS[currency]
  return symbol ? `${symbol}${n}` : `${currency} ${n}`
}

/** Splits a duration in minutes into whole hours and remaining minutes. */
export function formatDuration(totalMinutes: number): { h: number; m: number } {
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 }
}
