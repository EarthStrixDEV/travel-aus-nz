'use client'

import { useLayoutEffect } from 'react'
import { applyThemeCookie } from '@/lib/theme'

/**
 * Re-applies the theme cookie class when the root layout mounts. A TH<->EN switch is a
 * soft navigation that remounts the `[locale]` root layout, and React resets `<html>`
 * attributes on remount; the layout effect restores the class before paint.
 */
export function ThemeSync() {
  useLayoutEffect(applyThemeCookie, [])
  return null
}
