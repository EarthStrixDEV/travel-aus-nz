import type { Client } from '@/lib/content/shared'

/** Title of the trip Prepare creates when a signed-in user has none yet (plan deviation 6). */
export const DEFAULT_TRIP_TITLE = 'My trip'

/**
 * The user's most recent non-deleted trip. Prepare's checklist and packing rows hang off a trip, so with
 * `create` a first tick makes one ("My trip", no dates). `db` is the session client; RLS limits rows to the
 * user, and the explicit `user_id` filter keeps that true even under a service client.
 */
export async function currentTripId(db: Client, userId: string, { create }: { create: boolean }): Promise<string | null> {
  const { data, error } = await db
    .from('trips')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data) return data.id
  if (!create) return null

  const { data: created, error: insertError } = await db
    .from('trips')
    .insert({ user_id: userId, title: DEFAULT_TRIP_TITLE })
    .select('id')
    .single()
  if (insertError) throw insertError
  return created.id
}

/** `tripId` when it is this user's live trip, else null (callers answer 404, never 403). */
export async function ownedTripId(db: Client, userId: string, tripId: string): Promise<string | null> {
  const { data, error } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', userId).is('deleted_at', null).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}
