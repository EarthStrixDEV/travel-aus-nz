/** Pure Prepare model (spec §12): shared by the page (client), the API and tests. No server imports at runtime. */

export type PrepareCountry = 'au' | 'nz' | 'both'
export const MOMENTS = ['3m', '1m', '1w', 'day0'] as const
export type Moment = (typeof MOMENTS)[number]
export const SEASONS = ['summer', 'autumn', 'winter', 'spring'] as const
export type Season = (typeof SEASONS)[number]

export type ChecklistTemplate = { id: number; moment: Moment; title: string; note: string; appliesTo: ('au' | 'nz')[] }
export type RegionMonths = {
  slug: string
  name: string
  country: 'au' | 'nz'
  bestMonths: number[]
  /** 12 entries, January first; null where the editors have no row. */
  months: ({ comfort: number | null; crowds: number | null; recommended: boolean } | null)[]
}
export type PackingItem = { id: number; season: Season; group: string; title: string }
export type TitledItem = { title: string; text: string; icon?: string }
export type ConnectivityOption = { id: number; name: string; setup: string; cost: string | null; best: string; watch: string; verified: boolean }
export type TransferOption = {
  name: string
  mode: string | null
  durationMin: number | null
  fareMin: number | null
  fareMax: number | null
  currency: string | null
  verified: boolean
}
export type AirportTransfers = { airport: string; country: 'au' | 'nz' | null; city: { slug: string; name: string } | null; options: TransferOption[] }

export type PrepareData = {
  templates: ChecklistTemplate[]
  regions: RegionMonths[]
  packing: PackingItem[]
  facts: TitledItem[]
  health: TitledItem[]
  connectivity: ConnectivityOption[]
  transfers: AirportTransfers[]
}

const inCountry = (c: PrepareCountry) => (x: 'au' | 'nz' | null) => c === 'both' || x === null || x === c

/** The AU / NZ / Both tab: checklist items, season regions and airports for that country. */
export function forCountry(data: PrepareData, country: PrepareCountry): PrepareData {
  const ok = inCountry(country)
  return {
    ...data,
    templates: data.templates.filter((t) => country === 'both' || t.appliesTo.includes(country)),
    regions: data.regions.filter((r) => ok(r.country)),
    transfers: data.transfers.filter((a) => ok(a.country)),
  }
}

/** "n of m ready" and the first unticked item in moment order. */
export function progress(templates: ChecklistTemplate[], done: ReadonlySet<number>): { done: number; total: number; pct: number; next: ChecklistTemplate | null } {
  const ordered = [...templates].sort((a, b) => MOMENTS.indexOf(a.moment) - MOMENTS.indexOf(b.moment))
  const n = ordered.filter((t) => done.has(t.id)).length
  return {
    done: n,
    total: ordered.length,
    pct: ordered.length ? Math.round((n / ordered.length) * 100) : 0,
    next: ordered.find((t) => !done.has(t.id)) ?? null,
  }
}

/** Southern-hemisphere season of a month (1-12): Dec–Feb summer, Mar–May autumn, Jun–Aug winter, Sep–Nov spring. */
export function southernSeason(month: number): Season {
  return SEASONS[Math.floor((month % 12) / 3)]
}
