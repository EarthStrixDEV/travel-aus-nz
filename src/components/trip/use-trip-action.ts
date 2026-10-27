'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

/**
 * Runs a `/api/v1/me/*` write, then re-renders the server page (`router.refresh()`) so the trip on screen is
 * always what the database holds. `failed` is set when the request or the refresh fails.
 */
export function useTripAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)

  async function run(url: string, init: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }): Promise<Response | null> {
    setFailed(false)
    try {
      const res = await fetch(url, {
        method: init.method,
        ...(init.body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) } : {}),
      })
      if (!res.ok) throw new Error(String(res.status))
      startTransition(() => router.refresh())
      return res
    } catch {
      setFailed(true)
      return null
    }
  }

  return { run, pending, failed }
}
