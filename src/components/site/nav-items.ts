export type NavKey =
  | 'destinations'
  | 'map'
  | 'transport'
  | 'eatDrink'
  | 'gallery'
  | 'money'
  | 'visa'
  | 'prepare'
export type NavGroup = 'explore' | 'plan'
export type TabKey = 'discover' | 'map' | 'transit' | 'eat' | 'trip'

/** Desktop header + mobile menu + footer, in design order. Labels: `nav.<key>`; group labels: `nav.group.<group>`. */
export const navItems: { key: NavKey; href: string; group: NavGroup }[] = [
  { key: 'destinations', href: '/', group: 'explore' },
  { key: 'map', href: '/map', group: 'explore' },
  { key: 'transport', href: '/transport', group: 'explore' },
  { key: 'eatDrink', href: '/eat-drink', group: 'explore' },
  { key: 'gallery', href: '/gallery', group: 'explore' },
  { key: 'money', href: '/money', group: 'plan' },
  { key: 'visa', href: '/visa', group: 'plan' },
  { key: 'prepare', href: '/prepare', group: 'plan' },
]

/** Mobile bottom tab bar. Labels: `nav.tab.<key>`. Money and Visa are reached via the mobile menu. */
export const tabItems: { key: TabKey; href: string }[] = [
  { key: 'discover', href: '/' },
  { key: 'map', href: '/map' },
  { key: 'transit', href: '/transport' },
  { key: 'eat', href: '/eat-drink' },
  { key: 'trip', href: '/trip' },
]

/** `pathname` is locale-stripped. `/` matches only itself; other hrefs match themselves and sub-paths. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
