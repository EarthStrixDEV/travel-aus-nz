/** Locale-stripped path prefixes that need a signed-in user (guests browse everything else). */
export const GATED_PREFIXES = ['/prepare']

/** `pathname` is locale-stripped. `/prepare` and `/prepare/...` are gated; `/prepared` is not. */
export function isGatedPath(pathname: string): boolean {
  return GATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
