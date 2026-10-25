'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { createClient } from '@/lib/supabase/browser'

type Provider = 'google' | 'apple'

// Supabase `error.code` -> auth.* message key. Unknown codes fall back to sendFailed.
const ERROR_KEYS: Record<string, string> = {
  over_email_send_rate_limit: 'rateLimited',
  over_request_rate_limit: 'rateLimited',
  otp_disabled: 'signupDisabled',
  signup_disabled: 'signupDisabled',
  email_address_invalid: 'invalidEmail',
  validation_failed: 'invalidEmail',
  provider_disabled: 'providerDisabled',
}

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth')
  const [busy, setBusy] = useState<'email' | 'oauth' | null>(null)
  const pending = busy !== null
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string>()
  const [oauthError, setOauthError] = useState<string>()

  const errorText = (error: { code?: string }) => {
    const key = error.code ? ERROR_KEYS[error.code] : undefined
    return t((key ?? 'sendFailed') as 'sendFailed')
  }

  // `next` was sanitised server-side; encode it so it stays one query value.
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

  async function sendLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
    setBusy('email')
    setEmailError(undefined)
    setOauthError(undefined)
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo() },
      })
      if (error) setEmailError(errorText(error))
      else setSentTo(email)
    } catch {
      setEmailError(t('sendFailed'))
    } finally {
      setBusy(null)
    }
  }

  async function oauth(provider: Provider) {
    setBusy('oauth')
    setEmailError(undefined)
    setOauthError(undefined)
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo() },
      })
      if (error) {
        setOauthError(errorText(error))
        setBusy(null)
      }
      // On success the browser navigates away to the provider; keep buttons disabled.
    } catch {
      setOauthError(t('sendFailed'))
      setBusy(null)
    }
  }

  return (
    <div className="mt-8">
      <div aria-live="polite">
        {sentTo && <p className="text-base text-ink">{t('checkEmail', { email: sentTo })}</p>}
      </div>
      {!sentTo && (
        <>
          <form onSubmit={sendLink} className="flex flex-col gap-6">
            <TextField label={t('email')} name="email" type="email" required error={emailError} />
            <Button type="submit" disabled={pending} className="w-full">
              {busy === 'email' ? t('sending') : t('sendLink')}
            </Button>
          </form>
          <div className="my-6 flex items-center gap-4 text-ink-2">
            <span className="h-px flex-1 bg-line" />
            <span className="eyebrow">{t('or')}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="flex flex-col gap-3">
            <Button variant="ghost" disabled={pending} className="w-full" onClick={() => oauth('google')}>
              {t('google')}
            </Button>
            <Button variant="ghost" disabled={pending} className="w-full" onClick={() => oauth('apple')}>
              {t('apple')}
            </Button>
          </div>
          {oauthError && (
            <p role="alert" className="mt-4 text-[13px] font-normal text-copper">
              {oauthError}
            </p>
          )}
        </>
      )}
    </div>
  )
}
