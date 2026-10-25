/** What the providers are asked for. AUD is the pivot; USD is derived from the AUD rate when rebasing. */
export const FX_CODES = ['AUD', 'NZD', 'THB', 'EUR', 'GBP', 'JPY', 'SGD', 'CNY'] as const

/** Home currencies the design offers (spec §10). */
export const HOME_CURRENCIES = ['THB', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'CNY'] as const
export type HomeCurrency = (typeof HOME_CURRENCIES)[number]
export const DEFAULT_HOME: HomeCurrency = 'THB'

/** Every code that can appear in a snapshot or as a history quote (the nine `currencies` rows). */
export const ALL_CODES = ['AUD', 'NZD', 'USD', 'THB', 'EUR', 'GBP', 'JPY', 'SGD', 'CNY'] as const

/** `/fx/latest` reports `stale` once the newest snapshot is older than this. */
export const STALE_AFTER_MS = 6 * 3_600_000

/**
 * Controller ruling R3: `cost_reference_items.verified_at` is NOT NULL, so placeholder rows cannot be
 * detected per row. The prices are still editorial placeholders, so the page carries one "Placeholder"
 * tag on the cost table and the budget helper. Flip to false once the editors have verified the data.
 */
export const PRICES_ARE_PLACEHOLDERS = true
