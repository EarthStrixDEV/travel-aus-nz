'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { DEFAULT_HOME, HOME_CURRENCIES, STALE_AFTER_MS } from '@/lib/fx/constants'
import { formatNumber } from '@/lib/fx/convert'
import { formatSnapshotDate, formatUpdated } from '@/lib/fx/format'
import type { History } from '@/lib/fx/history'
import type { FxReference, FxSnapshot, MoneyTip } from '@/lib/fx/queries'
import type { Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/browser'
import { BudgetHelper } from './budget-helper'
import { Converter, type ConverterStatus } from './converter'
import { CostTable } from './cost-table'
import { CrossRate } from './cross-rate'
import { MoneyTips } from './money-tips'
import { RateTrend } from './rate-trend'

const isHome = (c: unknown): c is string => typeof c === 'string' && (HOME_CURRENCIES as readonly string[]).includes(c)
const rateDigits = (rate: number) => (rate < 10 ? 4 : 2)

/**
 * Everything below the page hero. Holds the one rate snapshot the server shipped and the home currency,
 * so every section converts locally. The only requests are the retry button, the profile's home currency
 * (signed in) and trend ranges that weren't prerendered.
 */
export function MoneyView({
  snapshot,
  reference,
  tips,
  history,
}: {
  snapshot: FxSnapshot | null
  reference: FxReference
  tips: MoneyTip[]
  history: History | null
}) {
  const t = useTranslations('money.converter')
  const locale = useLocale() as Locale
  const { user, ready: authReady } = useAuth()

  const [home, setHome] = useState<string>(DEFAULT_HOME)
  const picked = useRef(false)
  const [snap, setSnap] = useState<FxSnapshot | null>(snapshot)
  const [status, setStatus] = useState<ConverterStatus>(snapshot ? 'ready' : 'error')
  const [stale, setStale] = useState(false)

  // Default home currency comes from the signed-in profile; it must never override a pick the visitor already made.
  useEffect(() => {
    if (!authReady || !user) return
    let live = true
    createClient()
      .from('profiles')
      .select('home_currency')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (live && !picked.current && isHome(data?.home_currency)) setHome(data.home_currency)
      })
      .then(undefined, () => {})
    return () => {
      live = false
    }
  }, [authReady, user])

  // The page can be cached for up to an hour, so staleness is judged in the browser against the snapshot's own age.
  useEffect(() => {
    setStale(snap ? Date.now() - Date.parse(snap.fetched_at) > STALE_AFTER_MS : false)
  }, [snap])

  async function retry() {
    setStatus('loading')
    try {
      const res = await fetch('/api/v1/fx/latest')
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as FxSnapshot & { stale: boolean }
      setSnap({ base: body.base, rates: body.rates, fetched_at: body.fetched_at, source: body.source })
      setStale(body.stale)
      setStatus('ready')
    } catch (err) {
      console.error('[money] retry failed', err)
      setStatus('error')
    }
  }

  const rates = snap?.rates ?? null
  const rateAud = rates?.[home]
  const rateNzd = rates?.[home] && rates.NZD ? rates[home] / rates.NZD : undefined
  const rateLine =
    snap && rateAud && rateNzd
      ? t('rateLine', {
          aud: `${formatNumber(rateAud, rateDigits(rateAud))} ${home}`,
          nzd: `${formatNumber(rateNzd, rateDigits(rateNzd))} ${home}`,
          updated: formatUpdated(snap.fetched_at, locale),
        })
      : null
  const banner =
    snap && (status === 'error' || (stale && status !== 'loading'))
      ? { title: t('errorTitle'), text: t('errorText', { date: formatSnapshotDate(snap.fetched_at, locale) }) }
      : null

  function pickHome(code: string) {
    picked.current = true
    setHome(code)
  }

  return (
    <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-8 md:pt-12">
      <Converter home={home} onHome={pickHome} rates={rates} status={status} banner={banner} rateLine={rateLine} onRetry={retry} />
      <CrossRate rates={rates} />
      <RateTrend home={home} initial={history} />
      <CostTable costs={reference.costs} verifiedAt={reference.verifiedAt} home={home} rates={rates} />
      <BudgetHelper budgets={reference.budgets} home={home} rates={rates} />
      <MoneyTips tips={tips} />
    </div>
  )
}
