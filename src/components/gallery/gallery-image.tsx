'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GalleryPhoto } from '@/lib/gallery/filter'

/**
 * A photo in a box of its own aspect ratio. Under the image sits a placeholder block, so a file that is
 * missing from Storage (404) leaves a tidy placeholder instead of a broken image; a missing blurhash just
 * means no blur-up.
 */
export function GalleryImage({
  image,
  sizes,
  fit = 'cover',
  className = '',
  imageClassName = '',
}: {
  image: GalleryPhoto['image']
  sizes: string
  fit?: 'cover' | 'contain'
  /** On the ratio box. */
  className?: string
  /** On the `<img>` itself, e.g. a hover zoom. */
  imageClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // A 404 can land before React hydrates, when `onError` has nothing to listen on yet.
  useEffect(() => {
    const el = ref.current
    if (el?.complete && el.naturalWidth === 0) setFailed(true)
  }, [])

  return (
    <div className={`relative overflow-hidden bg-ph-2 ${className}`} style={{ aspectRatio: `${image.width} / ${image.height}` }}>
      <svg viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full">
        <path d="M0 160 L80 200 L150 110 L230 170 L300 130 V300 H0Z" className="fill-ph-3" />
        <path d="M0 250 Q150 232 300 246 V300 H0Z" className="fill-ph-1" />
      </svg>
      {!failed && (
        <Image
          ref={ref}
          src={image.url}
          alt={image.alt}
          fill
          sizes={sizes}
          placeholder={image.blurDataURL ? 'blur' : 'empty'}
          blurDataURL={image.blurDataURL}
          onError={() => setFailed(true)}
          className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${imageClassName}`}
        />
      )}
    </div>
  )
}
