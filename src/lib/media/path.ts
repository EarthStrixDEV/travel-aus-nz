/** Bucket-relative object key inside the Supabase `media` bucket. */
export function mediaPath(entity: string, id: string, hash: string): string {
  return `${entity}/${id}/${hash}.webp`
}

/** Public URL of an object in the `media` bucket (e.g. a `media_assets.path`). */
export function mediaUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`
}
