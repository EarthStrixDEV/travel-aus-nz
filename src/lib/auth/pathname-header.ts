export const PATHNAME_HEADER = 'x-pathname'

/**
 * Forwards the request path to server components as the `x-pathname` request header,
 * using Next's middleware request-header override protocol (the same one
 * `NextResponse.next({ request: { headers } })` writes). next-intl's response may
 * already carry overrides, so this appends rather than replaces. Redirects carry none
 * and need no header.
 */
export function withPathnameHeader(response: { headers: Headers }, pathnameWithSearch: string): void {
  const overrides = response.headers.get('x-middleware-override-headers')
  if (overrides === null) return
  const names = overrides.split(',').filter((n) => n !== PATHNAME_HEADER)
  response.headers.set('x-middleware-override-headers', [...names, PATHNAME_HEADER].join(','))
  response.headers.set(`x-middleware-request-${PATHNAME_HEADER}`, pathnameWithSearch)
}
