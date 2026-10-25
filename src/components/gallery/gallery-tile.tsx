import type { GalleryPhoto } from '@/lib/gallery/filter'
import { imageSizes } from '@/lib/media/path'
import { GalleryImage } from './gallery-image'

/**
 * Image + caption (title, type, region · season) of one grid tile. Not a client module, so the server-rendered
 * fallback can use it; the interactive wrapper (button or link) is the caller's. Block `span`s keep it valid inside a button.
 */
export function GalleryTile({ photo, type, caption }: { photo: GalleryPhoto; type: string; caption: string }) {
  return (
    <>
      <GalleryImage
        image={photo.image}
        sizes={imageSizes('grid')}
        className="rounded-md"
        imageClassName="transition-transform duration-[1800ms] ease-out motion-safe:group-hover:scale-[1.04]"
      />
      <span className="mt-3 flex items-baseline justify-between gap-3">
        <span className="block text-[17px] font-medium">{photo.title}</span>
        {type && <span className="block text-xs whitespace-nowrap text-ink-2">{type}</span>}
      </span>
      {caption && <span className="mt-0.5 block text-[13px] text-ink-2">{caption}</span>}
    </>
  )
}
