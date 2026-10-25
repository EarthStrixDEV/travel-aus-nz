export const THEME_COOKIE = 'theme'

const THEME_COOKIE_RE = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)`)

/**
 * Blocking inline script for `<head>`: applies the `theme` cookie (`light`|`dark`) as a
 * class on `<html>` before first paint. Anything else leaves no class, so the CSS
 * `prefers-color-scheme` media query decides. Runs client-side so the server never
 * reads cookies and pages stay static.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(${THEME_COOKIE_RE});if(m)document.documentElement.classList.add(m[1])}catch(e){}})()`

/**
 * Same as THEME_INIT_SCRIPT, for client code. Needed after a cross-locale soft
 * navigation: the `[locale]` root layout remounts and React resets `<html>` attributes,
 * dropping the class the inline script added.
 */
export function applyThemeCookie(): void {
  const m = document.cookie.match(THEME_COOKIE_RE)
  if (m) document.documentElement.classList.add(m[1])
}
