import { FETCH_TIMEOUT_MS, type FxProvider } from './provider'

/**
 * exchangerate.host `/live`: `{ success, quotes: { USDTHB: 33.1, ... } }`. Needs `EXCHANGERATE_HOST_KEY`;
 * without it this provider throws so ingestion falls through to the backup.
 */
export const exchangerateHost: FxProvider = {
  name: 'exchangerate.host',
  async fetchUsdRates(codes) {
    const key = process.env.EXCHANGERATE_HOST_KEY
    if (!key) throw new Error('EXCHANGERATE_HOST_KEY is not set')
    const url = new URL('https://api.exchangerate.host/live')
    url.searchParams.set('access_key', key)
    url.searchParams.set('source', 'USD')
    url.searchParams.set('currencies', codes.join(','))
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`exchangerate.host responded ${res.status}`)
    const body = (await res.json()) as { success?: boolean; quotes?: Record<string, number> }
    if (!body.success || !body.quotes) throw new Error('exchangerate.host returned no quotes')
    const out: Record<string, number> = {}
    for (const code of codes) {
      const rate = body.quotes[`USD${code}`]
      if (rate !== undefined) out[code] = rate
    }
    return out
  },
}
