/** Amount in `from` -> `to`, pivoting through AUD (`rates[X]` = X per 1 AUD; AUD is implicitly 1). NaN for an unknown code. */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  const rate = (code: string) => (code === 'AUD' ? 1 : rates[code])
  const f = rate(from)
  const t = rate(to)
  if (!(f > 0) || !(t > 0)) return NaN
  return (amount / f) * t
}

/** AUD -> NZD. */
export function crossRate(rates: Record<string, number>): number {
  return rates.NZD
}

/** "10,000" / "2.5" -> number; empty or junk -> 0. */
export function parseAmount(input: string): number {
  const n = Number.parseFloat(input.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Fixed-digit en-US number ("10,000.50"), the same on server and client so hydration matches. */
export function formatNumber(value: number, digits = 2): string {
  const v = Number.isFinite(value) ? value : 0
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Converted (home-currency) amount with its code: "1,234.56 THB"; yen has no minor unit. */
export function formatHome(value: number, code: string): string {
  return `${formatNumber(value, code === 'JPY' ? 0 : 2)} ${code}`
}
