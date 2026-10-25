import { cachedContent } from '@/lib/content/cache'
import type { Locale } from '@/lib/i18n/t'
import { createPublicClient } from '@/lib/supabase/public'
import { INITIAL_TREND } from './initial-trend'
import { loadHistory } from './history'
import { getLatestSnapshot, getReference } from './queries'

/**
 * Everything the prerendered /money page ships: one rate snapshot, the reference prices and the default
 * trend. All under the `fx` tag, so the cron's `revalidateTag('fx')` refreshes the page after each ingest.
 */
export async function getMoneyPageData(locale: Locale) {
  const [snapshot, reference, history] = await Promise.all([
    cachedContent(['fx', 'latest'], 'fx', () => getLatestSnapshot(createPublicClient()))(),
    cachedContent(['fx-reference', locale], 'fx', () => getReference(createPublicClient(), locale))(),
    cachedContent(
      ['fx-history', `${INITIAL_TREND.base}-${INITIAL_TREND.quote}`, INITIAL_TREND.range],
      'fx',
      () => loadHistory(createPublicClient(), INITIAL_TREND.base, INITIAL_TREND.quote, INITIAL_TREND.range),
      21600,
    )(),
  ])
  return { snapshot, reference, history }
}
