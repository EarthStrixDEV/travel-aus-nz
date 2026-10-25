/**
 * USD-based rates (units per 1 USD) -> AUD-based (units per 1 AUD): `rate[X] = usd[X] / usd['AUD']`.
 * AUD is pinned to 1 and USD is derived (`1 / usd.AUD`) since providers quote USD as the base.
 */
export function rebaseToAud(usd: Record<string, number>): Record<string, number> {
  const aud = usd.AUD
  if (!Number.isFinite(aud) || !(aud > 0)) throw new Error('USD->AUD rate missing or not positive')
  const out: Record<string, number> = {}
  for (const [code, rate] of Object.entries(usd)) out[code] = rate / aud
  out.AUD = 1
  out.USD = 1 / aud
  return out
}
