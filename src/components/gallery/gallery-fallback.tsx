import { Link } from '@/i18n/navigation'
import type { GalleryPhoto } from '@/lib/gallery/filter'
import { GalleryTile } from './gallery-tile'
import { caption, typeName, type T } from './labels'

/**
 * Server-rendered default view (no filters). It is the Suspense fallback of `GalleryBrowser`, so the prerendered
 * HTML carries real photo titles, captions and place links for crawlers; once the client mounts, `GalleryBrowser`
 * replaces it and applies the URL filters. The filter bar and lightbox are client-only and therefore absent here.
 */
export function GalleryFallback({ photos, t }: { photos: GalleryPhoto[]; t: T }) {
  return (
    <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-10 pb-24 md:pb-36">
      <p className="mb-6 text-sm text-ink-2">{t('count', { count: photos.length })}</p>
      <ul aria-label={t('results.label')} className="gap-x-7 [column-width:360px]">
        {photos.map((photo) => (
          <li key={photo.id} className="mb-7 break-inside-avoid">
            <Link href={{ pathname: '/map', query: { place: photo.place.slug } }} className="group block">
              <GalleryTile photo={photo} type={typeName(photo.type, photo.typeLabel, t)} caption={caption(photo, t)} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
