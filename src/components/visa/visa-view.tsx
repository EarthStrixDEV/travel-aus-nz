'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { OFFICIAL_FALLBACK, type EntryPayload } from '@/lib/entry/helper'
import { CountryTabs, type CountryTab } from './country-tabs'
import { DocumentsChecklist } from './documents-checklist'
import { EntryHelper } from './entry-helper'
import { Faq } from './faq'
import { KeepPlanning } from './keep-planning'
import { OfficialSources } from './official-sources'
import { PermissionTypes } from './permission-types'
import { Scams } from './scams'
import { Timeline } from './timeline'

/**
 * Everything on /visa below the hero. It holds the country tab and the ISR payload, so switching tabs and
 * answering the helper never touch the network. The default view (tabs "Both", empty helper) is plain HTML
 * from the server render.
 */
export function VisaView({ data, failed }: { data: EntryPayload; failed: boolean }) {
  const t = useTranslations('visa')
  const [country, setCountry] = useState<CountryTab>('both')
  const code = country === 'both' ? null : country === 'au' ? 'AU' : 'NZ'

  const permissions = data.permissions.filter((p) => !code || p.country === code)
  // If the links could not be loaded the built-in official sites still give the visitor somewhere to go.
  const allLinks = data.links.length ? data.links : [OFFICIAL_FALLBACK.AU, OFFICIAL_FALLBACK.NZ]
  const links = allLinks.filter((l) => !code || !l.country || l.country === code)

  return (
    <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-8 md:pt-12">
      <CountryTabs value={country} onChange={setCountry} />
      {failed ? (
        <p role="alert" className="mt-6 rounded-[10px] border border-line px-5 py-4 text-sm leading-[1.6] text-ink-2 print:hidden">
          {t('loadError')}
        </p>
      ) : null}

      <EntryHelper rules={data.rules} permissions={data.permissions} links={allLinks} country={country} />
      <PermissionTypes permissions={permissions} />
      <Timeline timeline={data.timeline} country={country} permissions={data.permissions} />

      <section className="mt-24 flex flex-col gap-12 md:mt-[120px] md:flex-row md:items-start md:gap-12">
        <DocumentsChecklist documents={data.documents} country={country} />
        <Scams />
      </section>

      <section className="mt-24 flex flex-col gap-12 md:mt-[120px] md:flex-row md:items-start md:gap-16 print:hidden">
        <OfficialSources links={links} />
        <Faq faqs={data.faqs} />
      </section>

      <KeepPlanning />
    </div>
  )
}
