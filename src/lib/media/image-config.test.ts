import { getImgProps } from 'next/dist/shared/lib/get-img-props'
import { imageConfigDefault } from 'next/dist/shared/lib/image-config'
import defaultLoader from 'next/dist/shared/lib/image-loader'
import { describe, expect, it } from 'vitest'
import { imageWidthConfig } from './image-config'
import { IMAGE_WIDTHS, imageSizes } from './path'

const imgConf = { ...imageConfigDefault, ...imageWidthConfig }

describe('image widths', () => {
  it('config serves exactly IMAGE_WIDTHS', () => {
    expect(imageWidthConfig.deviceSizes).toEqual([...IMAGE_WIDTHS])
    expect(imageWidthConfig.imageSizes).toEqual([])
  })

  it.each(['grid', 'lightbox'] as const)('the %s srcset only has 480 / 960 / 1920', (layout) => {
    const { props } = getImgProps(
      { src: 'https://cdn.test/media/a.jpg', alt: '', fill: true, sizes: imageSizes(layout) },
      { defaultLoader, imgConf: imgConf as never, blurComplete: false, showAltText: false },
    )
    const widths = [...(props.srcSet ?? '').matchAll(/w=(\d+)/g)].map((m) => Number(m[1]))
    expect(widths.length).toBeGreaterThan(0)
    expect(widths.every((w) => (IMAGE_WIDTHS as readonly number[]).includes(w))).toBe(true)
  })
})
