/** Locale-stripped path prefixes that need a signed-in user (guests browse everything else). */
export const GATED_PREFIXES = ['/prepare', '/trip']

/** `pathname` is locale-stripped. `/trip` and `/trip/...` are gated; `/trips` is not. */
export function isGatedPath(pathname: string): boolean {
  return GATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
