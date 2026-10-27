import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { t as tr, type Locale } from '@/lib/i18n/t'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { Option } from './fields'

/** Select options for admin forms, read through the editor's session (RLS: editors see every row). */
type Client = SupabaseClient<Database>

const name = (v: Json | null, locale: string) => tr(v as Record<string, string> | null, locale as Locale)

function must<T>(r: { data: T[] | null; error: unknown }, what: string): T[] {
  if (r.error) throw new Error(`Failed to load ${what}`)
  return r.data ?? []
}

/** Assets lacking credit/license are marked so editors see why a publish is refused. */
export async function mediaOptions(db: Client, unlicensedMark: string): Promise<Option[]> {
  const rows = must(await db.from('media_assets').select('id, path, credit, license').order('created_at', { ascending: false }), 'media')
  return rows.map((m) => ({
    value: m.id,
    label: m.credit?.trim() && m.license?.trim() ? m.path : `${m.path} · ${unlicensedMark}`,
  }))
}

export async function placeOptions(db: Client, locale: string, types?: Database['public']['Enums']['place_type'][]): Promise<Option[]> {
  let q = db.from('places').select('id, slug, name_i18n, type').order('slug')
  if (types) q = q.in('type', types)
  return must(await q, 'places').map((p) => ({ value: p.id, label: `${name(p.name_i18n, locale)} (${p.slug})` }))
}

export async function cityOptions(db: Client, locale: string): Promise<Option[]> {
  return must(await db.from('cities').select('id, name_i18n').order('id'), 'cities').map((c) => ({
    value: String(c.id),
    label: name(c.name_i18n, locale),
  }))
}

export async function regionOptions(db: Client, locale: string): Promise<Option[]> {
  return must(await db.from('regions').select('id, country, name_i18n').order('country').order('slug'), 'regions').map((r) => ({
    value: String(r.id),
    label: `${r.country} · ${name(r.name_i18n, locale)}`,
  }))
}

export async function tagOptions(db: Client, locale: string): Promise<Option[]> {
  return must(await db.from('tags').select('id, kind, name_i18n').order('kind').order('slug'), 'tags').map((t) => ({
    value: String(t.id),
    label: `${name(t.name_i18n, locale)} · ${t.kind}`,
  }))
}

export async function cuisineOptions(db: Client, locale: string): Promise<Option[]> {
  return must(await db.from('cuisines').select('id, slug, name_i18n').order('slug'), 'cuisines').map((c) => ({
    value: String(c.id),
    label: name(c.name_i18n, locale) || (c.slug ?? ''),
  }))
}

/** Phase 1 links stops by hand; capped so a full GTFS import can't blow up the page. */
export async function stopOptions(db: Client): Promise<Option[]> {
  return must(await db.from('transit_stops').select('id, name').order('name').limit(2000), 'stops').map((s) => ({
    value: String(s.id),
    label: `${s.name} (#${s.id})`,
  }))
}

export async function dishOptions(db: Client, locale: string): Promise<Option[]> {
  return must(await db.from('dishes').select('id, slug, name_i18n').order('slug'), 'dishes').map((d) => ({
    value: d.id,
    label: `${name(d.name_i18n, locale)} (${d.slug})`,
  }))
}

export async function agencyOptions(db: Client): Promise<Option[]> {
  return must(await db.from('transit_agencies').select('id, country, name').order('country').order('name'), 'agencies').map((a) => ({
    value: String(a.id),
    label: `${a.country} · ${a.name}`,
  }))
}

export async function cardOptions(db: Client): Promise<Option[]> {
  return must(await db.from('transit_cards').select('id, name').order('name'), 'cards').map((c) => ({ value: String(c.id), label: c.name }))
}

export async function permissionOptions(db: Client, locale: string): Promise<Option[]> {
  return must(await db.from('permission_types').select('id, country, name_i18n').order('country').order('id'), 'permissions').map(
    (p) => ({ value: String(p.id), label: `${p.country} · ${name(p.name_i18n, locale)}` }),
  )
}

export async function officialLinkOptions(db: Client, locale: string): Promise<Option[]> {
  return must(await db.from('official_links').select('id, title_i18n, url').order('id'), 'official links').map((l) => ({
    value: String(l.id),
    label: name(l.title_i18n, locale) || l.url,
  }))
}
