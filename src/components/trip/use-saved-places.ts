'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { useRequireLogin } from '@/components/auth/use-require-login'
import { track } from '@/lib/analytics/track'
import { createClient } from '@/lib/supabase/browser'

/** Save to My Trip picks: signed-in users write `saved_items` (RLS owner policy); guests get the login dialog. */
export function useSavedPlaces(ids: string[]) {
  const { user } = useAuth()
  const requireLogin = useRequireLogin()
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set())
  const key = ids.join(',')

  useEffect(() => {
    if (!user || !key) {
      setSaved(new Set())
      return
    }
    let active = true
    createClient()
      .from('saved_items')
      .select('entity_id')
      .eq('entity_type', 'place')
      .in('entity_id', key.split(','))
      .then(({ data }) => {
        if (active) setSaved(new Set((data ?? []).map((r) => r.entity_id)))
      })
    return () => {
      active = false
    }
  }, [user, key])

  function toggle(id: string) {
    requireLogin(() => {
      if (!user) return
      const adding = !saved.has(id)
      const apply = (on: boolean) =>
        setSaved((prev) => {
          const next = new Set(prev)
          if (on) next.add(id)
          else next.delete(id)
          return next
        })
      apply(adding)
      const db = createClient().from('saved_items')
      const request = adding
        ? db.insert({ user_id: user.id, entity_type: 'place', entity_id: id })
        : db.delete().eq('user_id', user.id).eq('entity_type', 'place').eq('entity_id', id)
      void request.then(({ error }) => {
        if (error) apply(!adding)
        else if (adding) track('save_item', { entity_type: 'place' })
      })
    })
  }

  return { saved, toggle }
}
