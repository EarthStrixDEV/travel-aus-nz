import type { Client } from '@/lib/content/shared'

/**
 * Prepare's two tick lists share one shape: a row per (trip, item) with a boolean. `checklist` ticks
 * `trip_checklist_items` (with `done_at`), `packing` ticks `trip_packing_items`.
 */
export type TickKind = 'checklist' | 'packing'

export async function readTicks(db: Client, kind: TickKind, tripId: string): Promise<number[]> {
  if (kind === 'checklist') {
    const { data, error } = await db.from('trip_checklist_items').select('template_id').eq('trip_id', tripId).eq('done', true)
    if (error) throw error
    return (data ?? []).map((r) => r.template_id)
  }
  const { data, error } = await db.from('trip_packing_items').select('item_id').eq('trip_id', tripId).eq('packed', true)
  if (error) throw error
  return (data ?? []).map((r) => r.item_id)
}

export async function writeTick(db: Client, kind: TickKind, tripId: string, itemId: number, on: boolean, now = new Date()): Promise<void> {
  const { error } =
    kind === 'checklist'
      ? await db
          .from('trip_checklist_items')
          .upsert({ trip_id: tripId, template_id: itemId, done: on, done_at: on ? now.toISOString() : null }, { onConflict: 'trip_id,template_id' })
      : await db.from('trip_packing_items').upsert({ trip_id: tripId, item_id: itemId, packed: on }, { onConflict: 'trip_id,item_id' })
  if (error) throw error
}

/** Reset: untick everything on the list for this trip. */
export async function clearTicks(db: Client, kind: TickKind, tripId: string): Promise<void> {
  const { error } =
    kind === 'checklist'
      ? await db.from('trip_checklist_items').delete().eq('trip_id', tripId)
      : await db.from('trip_packing_items').delete().eq('trip_id', tripId)
  if (error) throw error
}
