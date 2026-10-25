import { useTranslations } from 'next-intl'

/**
 * Flags a value the editors have not verified (`verified_at` is null). `legend` renders the same tag as a
 * sample inside the explanatory note, without counting as a flagged value.
 */
export function PlaceholderTag({ legend = false }: { legend?: boolean }) {
  const t = useTranslations('visa')
  return (
    <span
      {...(legend ? {} : { 'data-placeholder': '' })}
      className={`${legend ? '' : 'ml-1.5 '}inline-block whitespace-nowrap rounded-[4px] border border-dashed border-ink-3 px-1.5 align-middle text-[10px] font-medium tracking-[.14em] text-ink-2 uppercase`}
    >
      {t('placeholder')}
    </span>
  )
}
