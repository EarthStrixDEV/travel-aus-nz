/** Bucket-relative object key inside the Supabase `media` bucket. */
export function mediaPath(entity: string, id: string, hash: string): string {
  return `${entity}/${id}/${hash}.webp`
}
