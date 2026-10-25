'use client'

import { useTranslations } from 'next-intl'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'

type Kind = 'outdated' | 'broken' | 'unclear'
const KINDS: Kind[] = ['outdated', 'broken', 'unclear']
type Status = 'idle' | 'sending' | 'sent' | 'error' | 'limited'

/**
 * "Report outdated info" for one permission. Sends only what the visitor sees here (which item, what kind of
 * problem, an optional note): never the helper's answers. The server stores it in `content_feedback`.
 */
export function FeedbackForm({ entity, name, onClose }: { entity: string; name: string; onClose: () => void }) {
  const t = useTranslations('visa.feedback')
  const id = useId()
  const [kind, setKind] = useState<Kind>('outdated')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entity: entity.slice(0, 120), kind, ...(note.trim() ? { note: note.trim() } : {}) }),
      })
      setStatus(res.status === 202 ? 'sent' : res.status === 429 ? 'limited' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" className="rounded-md border border-line-2 p-3 text-[13px] leading-[1.6] text-ink-2">
        {t('thanks')}
        <button type="button" onClick={onClose} className="mt-2 block min-h-11 cursor-pointer text-[13px] font-medium text-copper underline-offset-2 hover:underline">
          {t('cancel')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border border-line-2 p-3" aria-label={t('title')}>
      <p className="text-[13px] font-medium">{t('about', { name })}</p>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-[12px] text-ink-2">{t('kind')}</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-[13px] transition-colors duration-500 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-copper ${
                kind === k ? 'border-copper bg-copper-tint font-medium text-copper' : 'border-line text-ink-2'
              }`}
            >
              <input type="radio" name={`${id}-kind`} value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {t(`kinds.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-[12px] text-ink-2">
        {t('note')}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full resize-y rounded-md border border-line bg-surface p-2.5 text-[14px] text-ink focus:border-copper focus:outline-none"
        />
      </label>
      <p className="text-[12px] text-ink-2">{t('hint')}</p>
      {status === 'error' || status === 'limited' ? (
        <p role="alert" className="text-[13px] text-copper">
          {status === 'limited' ? t('rateLimited') : t('error')}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={status === 'sending'} className="min-h-11 flex-1 px-4">
          {status === 'sending' ? t('sending') : t('send')}
        </Button>
        <Button variant="ghost" onClick={onClose} className="px-4">
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
