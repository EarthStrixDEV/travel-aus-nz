import { IMAGE_WIDTHS } from './path'

/**
 * `images` settings shared by next.config.ts and its test. Next builds every srcset from `deviceSizes` plus
 * `imageSizes`, so `imageSizes` stays empty: the CDN serves exactly 480 / 960 / 1920 (spec §6 media rules).
 */
export const imageWidthConfig = {
  deviceSizes: [...IMAGE_WIDTHS],
  imageSizes: [] as number[],
}
