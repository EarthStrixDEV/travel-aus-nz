import { Link } from '@/i18n/navigation'
import type { VenueCard } from '@/lib/venues/filter'

type T = (key: string, values?: Record<string, string | number>) => string

/**
 * Server-rendered default view (Restaurants, no filters). It is the Suspense fallback of
 * `VenueBrowser`, so the prerendered HTML carries real venue names and links for crawlers; once the
 * client mounts, `VenueBrowser` replaces it and applies the URL filters. Interactive controls
 * (Save, drawer) are client-only and therefore absent here.
 */
export function VenueFallback({ venues, t }: { venues: VenueCard[]; t: T }) {
  const items = venues.filter((v) => v.kind === 'restaurant')
  return (
    <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-10 pb-24 md:pb-36">
      <p className="mb-6 text-sm text-ink-2">{t('count.restaurant', { count: items.length })}</p>
      <ul aria-label={t('results.label')} className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-7 gap-y-10">
        {items.map((v) => (
          <li key={v.id} className="relative flex flex-col gap-3">
            <div className="aspect-[4/3] rounded-lg bg-ph-2" />
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow text-ink-2">{v.cuisine?.name}</p>
              {v.priceLevel !== null && v.priceLevel > 0 && (
                <p aria-label={t('card.priceLevel', { n: v.priceLevel })} className="text-[13px] font-medium tracking-[.06em]">
                  <span aria-hidden="true">
                    {'$'.repeat(v.priceLevel)}
                    <span className="text-ink-3">{'$'.repeat(Math.max(0, 4 - v.priceLevel))}</span>
                  </span>
                </p>
              )}
            </div>
            <h3 className="-mt-1 text-xl font-semibold">
              <Link
                href={{ pathname: '/map', query: { place: v.slug } }}
                className="after:absolute after:inset-0 after:content-[''] hover:text-copper"
              >
                {v.name}
              </Link>
            </h3>
            <p className="-mt-1.5 text-sm text-ink-2">{[v.hood, v.city.name].filter(Boolean).join(', ')}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
