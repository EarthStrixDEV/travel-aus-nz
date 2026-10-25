export const THEME_COOKIE = 'theme'

/**
 * Blocking inline script for `<head>`: applies the `theme` cookie (`light`|`dark`) as a
 * class on `<html>` before first paint. Anything else leaves no class, so the CSS
 * `prefers-color-scheme` media query decides. Runs client-side so the server never
 * reads cookies and pages stay static.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.classList.add(m[1])}catch(e){}})()`
