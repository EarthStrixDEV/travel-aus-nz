import { useTranslations } from 'next-intl'
import { MediaImage } from '@/components/home/media-image'
import type { ScenicCard } from '@/lib/content/transport'
import { formatMoney } from '@/lib/format/money'
import { ModeIcon, ModeStroke } from './route-legs'

/** §7 scenic rail & ferry routes (editorial `scenic_routes`, published only). Hidden when there are none. */
export function ScenicRoutes({ routes }: { routes: ScenicCard[] }) {
  const t = useTranslations('transport.scenic')
  const tMode = useTranslations('transport.mode')
  if (routes.length === 0) return null

  return (
    <section aria-labelledby="scenic-routes" className="mt-24 bg-deep text-on-deep md:mt-[140px]">
      <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] py-20 md:py-28">
        <p className="eyebrow text-[#D08A5E]">{t('eyebrow')}</p>
        <h2 id="scenic-routes" className="mt-3.5 text-[28px] leading-[1.1] font-semibold md:text-[clamp(30px,3.2vw,46px)]">
          {t('title')}
        </h2>
        <ul className="mt-10 grid gap-8 md:mt-12 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {routes.map((r) => {
            const meta = [r.mode ? tMode(r.mode) : null, r.country ? t(`country.${r.country}`) : null].filter(Boolean).join(' · ')
            const when = [r.duration, r.frequency].filter(Boolean).join(' · ')
            return (
              <li key={r.slug}>
                <article className="flex flex-col gap-3.5">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#2A3953]">
                    <MediaImage media={r.image} />
                  </div>
                  {meta && (
                    <p className="eyebrow flex items-center gap-2 text-on-deep/70">
                      {r.mode && <ModeIcon mode={r.mode} size={13} />}
                      {meta}
                    </p>
                  )}
                  <h3 className="text-[22px] font-semibold">{r.name}</h3>
                  {(r.from || r.to) && (
                    <p className="flex items-center gap-2.5 text-[13px] text-on-deep/80">
                      <span>{r.from}</span>
                      <span className="flex-1 text-[#D08A5E]">
                        <ModeStroke mode={r.mode ?? 'train'} />
                      </span>
                      <span>{r.to}</span>
                    </p>
                  )}
                  {r.line && <p className="text-sm leading-[1.6] text-on-deep/80">{r.line}</p>}
                  <p className="flex justify-between gap-4 border-t border-on-deep/15 pt-3 text-[13px] text-on-deep/80">
                    <span>{when}</span>
                    {r.fareFrom !== null && r.currency && (
                      <span className="font-medium text-on-deep">{t('fareFrom', { price: formatMoney(r.fareFrom, r.currency) })}</span>
                    )}
                  </p>
                </article>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
