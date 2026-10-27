const OFFICIAL_SUFFIXES = ['gov.au', 'govt.nz']

/**
 * Official links are Australian / New Zealand government pages only: `https:` and a host that is `gov.au`,
 * `govt.nz` or a subdomain of them (exact suffix after a dot, so `evilgov.au` is rejected). Shared by the admin
 * form and the link-check job so an editor URL can never point the server at another host.
 */
export function isAllowedOfficialUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  return OFFICIAL_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}
