export interface FxProvider {
  name: string
  /** Units of each requested code per 1 USD. Throws when the provider is unavailable. */
  fetchUsdRates(codes: string[]): Promise<Record<string, number>>
}

export const FETCH_TIMEOUT_MS = 8000
