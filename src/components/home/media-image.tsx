'use client'

import { useEffect, useRef, useState } from 'react'
import type { MediaRef } from '@/lib/content/shared'

/**
 * Fills its positioned parent. Renders nothing when there is no image or it fails to load,
 * so the parent's placeholder background (`bg-ph-*`) shows instead of a broken-image icon.
 */
export function MediaImage({ media, className = '', eager = false }: { media: MediaRef | null; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // A load error can fire before hydration attaches onError; catch that case here.
  useEffect(() => {
    const img = ref.current
    if (img?.complete && img.naturalWidth === 0) setFailed(true)
  }, [media?.url])

  if (!media || failed) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, sized by the parent
    <img
      ref={ref}
      src={media.url}
      alt={media.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={`absolute inset-0 size-full object-cover ${className}`}
    />
  )
}
