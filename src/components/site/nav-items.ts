export type NavKey = 'destinations' | 'map' | 'dishes' | 'currency' | 'visa' | 'prepare'
export type TabKey = 'discover' | 'map' | 'eat' | 'money' | 'trip'

/** Desktop header + mobile menu, in design order. Labels: `nav.<key>`. */
export const navItems: { key: NavKey; href: string }[] = [
  { key: 'destinations', href: '/' },
  { key: 'map', href: '/map' },
  { key: 'dishes', href: '/dishes' },
  { key: 'currency', href: '/currency' },
  { key: 'visa', href: '/visa' },
  { key: 'prepare', href: '/prepare' },
]

/** Mobile bottom tab bar. Labels: `nav.tab.<key>`. */
export const tabItems: { key: TabKey; href: string }[] = [
  { key: 'discover', href: '/' },
  { key: 'map', href: '/map' },
  { key: 'eat', href: '/dishes' },
  { key: 'money', href: '/currency' },
  { key: 'trip', href: '/prepare' },
]

/** `pathname` is locale-stripped. `/` matches only itself; other hrefs match themselves and sub-paths. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
