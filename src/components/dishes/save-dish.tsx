'use client'

import { useTranslations } from 'next-intl'
import { useSaved } from '@/components/trip/use-saved-places'
import { Button } from '@/components/ui/button'
import { BookmarkIcon } from '@/components/venues/venue-card'

/** "Save to My Trip" on the dish page (`saved_items` entity `dish`; guests get the login dialog). */
export function SaveDish({ id }: { id: string }) {
  const t = useTranslations('dishes.detail')
  const { saved, toggle } = useSaved('dish', [id])
  const on = saved.has(id)
  return (
    <Button variant={on ? 'ghost' : 'primary'} aria-pressed={on} onClick={() => toggle(id)}>
      <BookmarkIcon filled={on} />
      {on ? t('saved') : t('save')}
    </Button>
  )
}
