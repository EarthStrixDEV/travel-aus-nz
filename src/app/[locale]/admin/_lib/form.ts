import { z } from 'zod'

/**
 * Shared pieces for the admin entity forms: form-data parsing, Zod building blocks whose
 * messages are `admin.errors.*` keys, the media-license publish rule, and DB error mapping.
 * Each entity keeps its own schema + action; this module only removes the repetition.
 */

export type SaveResult = { error?: string; fieldErrors?: Record<string, string> }
type Translate = (key: string) => string

export const STATUSES = ['draft', 'published', 'archived'] as const
export const COUNTRIES = ['AU', 'NZ'] as const
export const TRANSIT_MODES = ['train', 'metro', 'tram', 'bus', 'coach', 'ferry', 'walk'] as const

// ---------------------------------------------------------------------------
// Zod building blocks. A message is the `admin.errors.<key>` it maps to.
// ---------------------------------------------------------------------------
export const status = z.enum(STATUSES, 'choice')
export const country = z.enum(COUNTRIES, 'choice')
export const slug = z.string().regex(/^[a-z0-9-]+$/, 'slug')
export const required = z.string().min(1, 'required').max(5000, 'tooLong')
export const optional = z.string().max(5000, 'tooLong').optional()

export const int = (min: number, max: number) => z.coerce.number('number').int('integer').min(min, 'range').max(max, 'range')
export const money = z.coerce.number('number').min(0, 'range').max(999999.99, 'range')
export const date = z.iso.date('date')
// Postgres `time`: HH:MM[:SS], plus 24:00 for "until midnight".
export const time = z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?|24:00(?::00)?)$/, 'time')
// Permissive GUID shape: seed rows use non-RFC ids such as a0000000-0000-0000-0000-000000000001.
export const uuid = z.guid('choice')
export const httpUrl = z.url({ protocol: /^https?$/, error: 'url' })
export const currency = z.string().regex(/^[A-Z]{3}$/, 'currency')
export const lng = z.coerce.number('lng').min(-180, 'lng').max(180, 'lng')
export const lat = z.coerce.number('lat').min(-90, 'lat').max(90, 'lat')
/** An HTML checkbox: present ("on") is true, absent is false. */
export const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())
/** `name[]` checkbox groups: absent means none ticked. */
export const many = <T extends z.ZodType>(item: T) => z.array(item).default([])

type Pair<N extends string, S> = { [K in `${N}_th` | `${N}_en`]: S }

/** `{name}_th` + `{name}_en`, both required (as for cities). */
export function i18nRequired<N extends string>(name: N): Pair<N, typeof required> {
  return { [`${name}_th`]: required, [`${name}_en`]: required } as Pair<N, typeof required>
}

/** `{name}_th` + `{name}_en`, both optional. */
export function i18nOptional<N extends string>(name: N): Pair<N, typeof optional> {
  return { [`${name}_th`]: optional, [`${name}_en`]: optional } as Pair<N, typeof optional>
}

/** Parsed `{name}_th` / `{name}_en` -> the `*_i18n` jsonb value; null when both are blank. */
export function toI18n(data: Record<string, unknown>, name: string): { th?: string; en?: string } | null {
  const th = data[`${name}_th`]
  const en = data[`${name}_en`]
  const out: { th?: string; en?: string } = {}
  if (typeof th === 'string' && th) out.th = th
  if (typeof en === 'string' && en) out.en = en
  return out.th || out.en ? out : null
}

// ---------------------------------------------------------------------------
// Media license rule: published content may only reference credited + licensed assets.
// The action loads the referenced assets' credit/license and passes them as `media`.
// ---------------------------------------------------------------------------
export const mediaMeta = z.object({ credit: z.string().nullable(), license: z.string().nullable() })
export type MediaMeta = z.infer<typeof mediaMeta>
export const mediaList = z.array(mediaMeta).default([])

export const isLicensed = (m: MediaMeta) => Boolean(m.credit?.trim() && m.license?.trim())

/** superRefine: when `isPublic(data)`, every `data.media` asset must have credit + license (error on `path`). */
export function licensedMedia<T extends { media: MediaMeta[] }>(isPublic: (data: T) => boolean, path: string) {
  return (data: T, ctx: z.RefinementCtx<T>) => {
    if (isPublic(data) && !data.media.every(isLicensed)) ctx.addIssue({ code: 'custom', message: 'license', path: [path] })
  }
}

// ---------------------------------------------------------------------------
// FormData -> plain input
// ---------------------------------------------------------------------------

/**
 * Trimmed string fields; blanks are dropped so optional fields read as undefined and
 * `z.coerce.number()` sees NaN (invalid) rather than 0. `key[]` fields become arrays.
 */
export function formToInput(formData: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  for (const key of new Set(formData.keys())) {
    if (key.startsWith('$ACTION')) continue
    if (key.endsWith('[]')) {
      input[key.slice(0, -2)] = formData
        .getAll(key)
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean)
      continue
    }
    const raw = formData.get(key)
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (value !== '') input[key] = value
  }
  return input
}

/**
 * Repeating rows posted as parallel `${prefix}_${field}[]` columns, zipped into objects.
 * Blank cells are omitted; rows with no value at all are dropped.
 */
export function rows<F extends string>(formData: FormData, prefix: string, fields: readonly F[]): Partial<Record<F, string>>[] {
  const cols = fields.map((f) => formData.getAll(`${prefix}_${f}[]`).map((v) => (typeof v === 'string' ? v.trim() : '')))
  const length = Math.max(0, ...cols.map((c) => c.length))
  const out: Partial<Record<F, string>>[] = []
  for (let i = 0; i < length; i++) {
    const row: Partial<Record<F, string>> = {}
    fields.forEach((f, j) => {
      const v = cols[j][i]
      if (v) row[f] = v
    })
    if (Object.keys(row).length > 0) out.push(row)
  }
  return out
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
const MESSAGE_KEYS = new Set([
  'required', 'tooLong', 'slug', 'choice', 'number', 'integer', 'range', 'date', 'time', 'url', 'currency',
  'lng', 'lat', 'license', 'hoursPair', 'duplicateRow', 'nationality',
])

/** Zod issues -> `{ field: translated message }`, keyed by the first path segment; first issue per field wins. */
export function fieldErrors(issues: readonly z.core.$ZodIssue[], t: Translate): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const field = issue.path[0]
    if (typeof field !== 'string' || out[field]) continue
    const key = MESSAGE_KEYS.has(issue.message)
      ? issue.message
      : issue.code === 'invalid_type'
        ? 'required'
        : issue.code === 'invalid_value'
          ? 'choice'
          : 'invalid'
    out[field] = t(`errors.${key}`)
  }
  return out
}

/** A PostgREST error -> translated message; never surfaces backend text. */
export function dbError(error: { code?: string }, t: Translate): string {
  if (error.code === '23505') return t('errors.duplicate')
  if (error.code === '42501') return t('errors.forbidden')
  if (error.code === '23503') return t('errors.reference')
  return t('errors.saveFailed')
}

const SERIAL = z.coerce.number().int().positive().max(2147483647)

/** Action id argument: null = create; undefined = malformed (reject before the DB). */
export function serialId(id: number | null): number | null | undefined {
  if (id === null) return null
  const r = SERIAL.safeParse(id)
  return r.success ? r.data : undefined
}

export function uuidId(id: string | null): string | null | undefined {
  if (id === null) return null
  return uuid.safeParse(id).success ? id : undefined
}

/** Route param for `[id]` pages: "new", a serial or a GUID; anything else is a 404. */
export const SERIAL_PARAM = /^[1-9]\d{0,9}$/
export const UUID_PARAM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
