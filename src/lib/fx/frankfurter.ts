import { FETCH_TIMEOUT_MS, type FxProvider } from './provider'

/**
 * Frankfurter (ECB reference rates, no key): `GET /v1/latest?from=USD&to=AUD,NZD` -> `{ rates: { AUD: 1.5 } }`.
 * api.frankfurter.app now 301-redirects here, so the canonical host is called directly.
 */
export const frankfurter: FxProvider = {
  name: 'frankfurter',
  async fetchUsdRates(codes) {
    const url = new URL('https://api.frankfurter.dev/v1/latest')
    url.searchParams.set('from', 'USD')
    url.searchParams.set('to', codes.join(','))
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`frankfurter responded ${res.status}`)
    const body = (await res.json()) as { rates?: Record<string, number> }
    if (!body.rates) throw new Error('frankfurter returned no rates')
    return body.rates
  },
}
