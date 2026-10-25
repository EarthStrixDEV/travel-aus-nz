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

// supabase-js can't type column names over a union of table names; rows stay typed per table below.
type LooseTable = {
  upsert(rows: object[], opts: { onConflict: string }): PromiseLike<{ error: DbError | null }>
  select(columns: string): { eq(column: string, value: string | number): PromiseLike<{ data: Record<string, unknown>[] | null; error: DbError | null }> }
  delete(): { match(filter: Record<string, unknown>): PromiseLike<{ error: DbError | null }> }
}

/** Postgres returns `time` as HH:MM:SS; the form posts HH:MM. Compare keys in one format. */
export const timeKey = (v: unknown) => {
  const s = String(v)
  return /^\d{2}:\d{2}$/.test(s) ? `${s}:00` : s
}

/**
 * Make one parent's rows in a child table equal `rows`, without a window where live data is
 * gone: upsert the new set on the table's primary key (only the columns given are written),
 * then delete the existing rows whose key is not in the new set. Stops at the first error,
 * so a failed upsert leaves the existing rows untouched.
 */
export async function syncChildren<T extends keyof Tables>(
  db: Client,
  table: T,
  opts: {
    parent: [column: keyof Tables[T]['Row'] & string, id: string | number]
    /** Primary-key columns besides the parent column. */
    keys: (keyof Tables[T]['Row'] & string)[]
    rows: Tables[T]['Insert'][]
    /** Per-column key normalisers (e.g. `timeKey`); default `String`. */
    normalize?: Partial<Record<string, (v: unknown) => string>>
  },
): Promise<DbError | null> {
  const [parentColumn, parentId] = opts.parent
  const from = () => db.from(table) as unknown as LooseTable
  const keyOf = (row: Record<string, unknown>) => opts.keys.map((k) => (opts.normalize?.[k] ?? String)(row[k])).join('\u0000')

  if (opts.rows.length > 0) {
    const { error } = await from().upsert(opts.rows as object[], { onConflict: [parentColumn, ...opts.keys].join(',') })
    if (error) return error
  }

  const existing = await from().select(opts.keys.join(', ')).eq(parentColumn, parentId)
  if (existing.error) return existing.error
  const keep = new Set((opts.rows as Record<string, unknown>[]).map(keyOf))
  for (const row of existing.data ?? []) {
    if (keep.has(keyOf(row))) continue
    const filter: Record<string, unknown> = { [parentColumn]: parentId }
    for (const k of opts.keys) filter[k] = row[k]
    const { error } = await from().delete().match(filter)
    if (error) return error
  }
  return null
}
