import { useTranslations } from 'next-intl'
import { PRICES_ARE_PLACEHOLDERS } from '@/lib/fx/constants'

/** One page-level flag (controller ruling R3), not a per-row check: renders nothing once prices are verified. */
export function PlaceholderTag() {
  const t = useTranslations('money')
  if (!PRICES_ARE_PLACEHOLDERS) return null
  return (
    <span className="inline-flex items-center rounded-full border border-copper px-2.5 py-0.5 align-middle text-[11px] font-medium text-copper">
      {t('placeholder')}
    </span>
  )
}
