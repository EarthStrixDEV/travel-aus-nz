export const THEME_COOKIE = 'theme'

export type ThemePref = 'light' | 'dark' | 'system'

/** Cookie value → preference. Anything other than `light`/`dark` means "follow the OS". */
export function parseThemeCookie(value: string | undefined): ThemePref {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/** Class for `<html>`. `system` renders no class so the CSS media query decides. */
export function themeClass(pref: ThemePref): '' | 'light' | 'dark' {
  return pref === 'system' ? '' : pref
}
