import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { uuid, type MediaMeta } from './form'

type Client = SupabaseClient<Database>
type DbError = { code?: string }
type Tables = Database['public']['Tables']

/** Credit/license of the given assets, for the publish rule. Unknown ids are left to the FK. */
export async function mediaMetaFor(db: Client, ids: unknown[]): Promise<{ media: MediaMeta[]; error: DbError | null }> {
  // Malformed ids are skipped here; the schema reports them as field errors.
  const wanted = ids.filter((id): id is string => uuid.safeParse(id).success)
  if (wanted.length === 0) return { media: [], error: null }
  const { data, error } = await db.from('media_assets').select('credit, license').in('id', wanted)
  return { media: data ?? [], error }
}

// supabase-js can't type `.eq(column)` over a union of table names; rows stay typed per table below.
type LooseTable = {
  delete(): { eq(column: string, value: string | number): PromiseLike<{ error: DbError | null }> }
  insert(rows: object[]): PromiseLike<{ error: DbError | null }>
}

/**
 * Replace one parent's rows in a child table: delete, then insert. PostgREST has no
 * transaction here, so a failed insert leaves the set empty until the editor re-saves.
 */
export async function replaceChildren<T extends keyof Tables>(
  db: Client,
  table: T,
  parentColumn: keyof Tables[T]['Row'] & string,
  parentId: string | number,
  rows: Tables[T]['Insert'][],
): Promise<DbError | null> {
  const del = await (db.from(table) as unknown as LooseTable).delete().eq(parentColumn, parentId)
  if (del.error) return del.error
  if (rows.length === 0) return null
  const ins = await (db.from(table) as unknown as LooseTable).insert(rows as object[])
  return ins.error
}
