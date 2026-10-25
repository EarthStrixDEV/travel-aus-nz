export const PATHNAME_HEADER = 'x-pathname'

/**
 * Sets the request path as the `x-pathname` request header. Call on the incoming
 * request's headers before next-intl's handler, which forwards request headers to
 * server components. Overwrites any client-supplied value.
 */
export function setPathnameHeader(headers: Headers, pathnameWithSearch: string): void {
  headers.set(PATHNAME_HEADER, pathnameWithSearch)
}
