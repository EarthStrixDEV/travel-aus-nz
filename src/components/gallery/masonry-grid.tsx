'use client'

import { useTranslations } from 'next-intl'
import type { GalleryPhoto } from '@/lib/gallery/filter'
import { GalleryTile } from './gallery-tile'
import { caption, typeName, type T } from './labels'

/**
 * Masonry by CSS columns: each tile keeps its own `width / height` ratio, so the grid needs no JS to lay out
 * (and renders identically on the server). Each tile is a button that opens the lightbox at its index.
 */
export function MasonryGrid({ photos, onOpen }: { photos: GalleryPhoto[]; onOpen: (index: number, opener: HTMLElement) => void }) {
  const t = useTranslations('gallery') as unknown as T
  return (
    <ul aria-label={t('results.label')} className="gap-x-7 [column-width:360px]">
      {photos.map((photo, i) => (
        <li key={photo.id} className="mb-7 break-inside-avoid">
          <button
            type="button"
            data-photo-id={photo.id}
            aria-label={t('tile.open', { title: photo.title })}
            onClick={(e) => onOpen(i, e.currentTarget)}
            className="group block w-full cursor-pointer text-left"
          >
            <GalleryTile photo={photo} type={typeName(photo.type, photo.typeLabel, t)} caption={caption(photo, t)} />
          </button>
        </li>
      ))}
    </ul>
  )
}
