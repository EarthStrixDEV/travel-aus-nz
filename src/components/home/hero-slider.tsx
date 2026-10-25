'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { IconButton } from '@/components/ui/button'
import type { HomeSlide } from '@/lib/content/home'
import { MediaImage } from './media-image'

const INTERVAL_MS = 7000
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Hero carousel: up to four slides, autoplay (off under reduced motion), pause button, dots and a "01 / 04" counter. */
export function HeroSlider({ slides, children }: { slides: HomeSlide[]; children: ReactNode }) {
  const t = useTranslations('home.hero')
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = slides.length
  const autoplay = total > 1 && !paused && !reduced

  useEffect(() => {
    if (!autoplay) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % total), INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [autoplay, total])

  const current = slides[index]

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('carousel')}
      className="relative h-[640px] overflow-hidden bg-deep text-on-deep md:h-[800px]"
    >
      <div aria-live={autoplay ? 'off' : 'polite'}>
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={t('slide', { n: i + 1, total })}
            aria-hidden={i !== index}
            className={`absolute inset-0 bg-ph-3 transition-opacity duration-[2200ms] ease-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <MediaImage media={slide.image} eager={i === 0} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,18,34,.15)_35%,rgba(10,18,34,.7)_100%)]" />

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pb-6 md:pb-12">
        {children}

        {total > 0 && current && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 md:mt-8">
            <p className="text-[13px] font-normal text-on-deep/85">
              <span className="font-medium">{t('counter', { current: pad(index + 1), total: pad(total) })}</span>
              {current.caption && <> — {current.place?.name ?? current.caption}</>}
            </p>
            <div className="flex items-center gap-1">
              {total > 1 && !reduced && (
                <IconButton
                  label={paused ? t('play') : t('pause')}
                  onClick={() => setPaused((p) => !p)}
                  className="border-on-deep/30 text-on-deep hover:border-on-deep"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    {paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
                  </svg>
                </IconButton>
              )}
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={t('showSlide', { n: i + 1 })}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                  className="group flex h-11 w-9 cursor-pointer items-center justify-center"
                >
                  <span
                    className={`h-0.5 w-7 transition-colors duration-1000 ${i === index ? 'bg-on-deep' : 'bg-on-deep/35 group-hover:bg-on-deep/70'}`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
