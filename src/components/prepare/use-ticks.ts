'use client'

import { useState } from 'react'

/**
 * One tick list (checklist or packing) synced to `/api/v1/me/*`. Ticks apply at once and roll back when the
 * request fails. The first tick of a user with no trip gets one created server-side; its id comes back and is
 * used from then on, so both lists land on the same trip.
 */
export function useTicks({
  initial,
  tripId,
  onTripId,
  endpoint,
  field,
}: {
  initial: number[]
  tripId: string | null
  onTripId: (id: string) => void
  endpoint: (id: number) => string
  field: 'done' | 'packed'
}) {
  const [ticked, setTicked] = useState<ReadonlySet<number>>(() => new Set(initial))
  const [failed, setFailed] = useState(false)

  const set = (id: number, on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  async function toggle(id: number): Promise<boolean> {
    const on = !ticked.has(id)
    set(id, on)
    setFailed(false)
    try {
      const res = await fetch(endpoint(id), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...(tripId ? { trip_id: tripId } : {}), [field]: on }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const body: { trip_id: string } = await res.json()
      if (body.trip_id !== tripId) onTripId(body.trip_id)
      return on
    } catch {
      set(id, !on)
      setFailed(true)
      return !on
    }
  }

  async function reset(resetEndpoint: string | null) {
    const before = ticked
    setTicked(new Set())
    setFailed(false)
    if (!resetEndpoint) return
    try {
      const res = await fetch(resetEndpoint, { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      setTicked(before)
      setFailed(true)
    }
  }

  return { ticked, toggle, reset, failed }
}
