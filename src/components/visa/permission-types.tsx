'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import type { EntryPermission } from '@/lib/entry/helper'
import { FeedbackForm } from './feedback-form'
import { PlaceholderTag } from './placeholder-tag'

const ICONS = {
  app: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  doc: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6',
  leaf: 'M5 21c0-9 5-15 15-16-1 10-7 15-15 16zM5 21l8-8',
  pass: 'M5 3h14v18H5zM12 9.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 17h6',
}

function iconFor(slug: string): string {
  if (/ivl|levy/.test(slug)) return ICONS.leaf
  if (/eta/.test(slug)) return ICONS.app
  if (/visa/.test(slug)) return ICONS.doc
  return ICONS.pass
}

function Field({ label, value, flagged }: { label: string; value: string; flagged?: boolean }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 border-t border-line-2 pt-2.5">
      <span className="text-[10px] font-medium tracking-[.18em] text-ink-2 uppercase">{label}</span>
      <span className="text-sm leading-normal">
        {value}
        {flagged ? <PlaceholderTag /> : null}
      </span>
    </div>
  )
}

function PermissionCard({ permission }: { permission: EntryPermission }) {
  const t = useTranslations('visa.permissions')
  const formId = useId()
  const [reporting, setReporting] = useState(false)
  const unverified = permission.verifiedAt === null

  return (
    <article className="flex flex-col gap-3.5 rounded-[10px] border border-line bg-surface p-6 max-sm:w-[290px] max-sm:flex-none max-sm:snap-start">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-medium tracking-[.18em] whitespace-nowrap text-ink-2 uppercase">{permission.country}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <path d={iconFor(permission.slug)} />
        </svg>
      </div>
      <h3 className="text-xl leading-tight font-semibold">{permission.name}</h3>
      <Field label={t('who')} value={permission.who} />
      <Field label={t('how')} value={permission.how} />
      <Field label={t('processing')} value={permission.processing} flagged={unverified} />
      <Field label={t('fee')} value={permission.fee} flagged={unverified} />
      <Field label={t('validity')} value={permission.validity} flagged={unverified} />
      {permission.good ? (
        <p className="mt-auto border-t border-line-2 pt-3 text-[13px] leading-[1.6] text-ink-2">
          <span className="font-medium text-ink">{t('good')} · </span>
          {permission.good}
        </p>
      ) : null}
      <div className="print:hidden">
        <button
          type="button"
          aria-expanded={reporting}
          aria-controls={formId}
          onClick={() => setReporting((v) => !v)}
          className="min-h-11 cursor-pointer text-[13px] font-medium text-copper underline-offset-2 hover:underline"
        >
          {t('report')}
        </button>
        {reporting ? (
          <div id={formId} className="mt-1">
            <FeedbackForm entity={permission.slug} name={permission.name} onClose={() => setReporting(false)} />
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function PermissionTypes({ permissions }: { permissions: EntryPermission[] }) {
  const t = useTranslations('visa.permissions')
  return (
    <section aria-label={t('label')} className="mt-24 md:mt-[120px] print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow text-copper">{t('eyebrow')}</p>
          <h2 className="mt-3 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">{t('title')}</h2>
        </div>
        <p className="text-[13px] text-ink-2">{t.rich('note', { tag: () => <PlaceholderTag legend /> })}</p>
      </div>
      {permissions.length ? (
        <div
          className="-mx-4 mt-7 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-5 sm:gap-5"
        >
          {permissions.map((p) => (
            <PermissionCard key={p.id} permission={p} />
          ))}
        </div>
      ) : (
        <p className="mt-7 text-sm text-ink-2">{t('empty')}</p>
      )}
    </section>
  )
}
