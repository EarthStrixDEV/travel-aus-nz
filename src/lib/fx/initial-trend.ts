import type { HistoryRange } from './history'

/** The trend view prerendered with the page (default home currency THB, 1 month). Other views load on demand. */
export const INITIAL_TREND: { base: 'AUD'; quote: 'THB'; range: HistoryRange } = { base: 'AUD', quote: 'THB', range: '1m' }
