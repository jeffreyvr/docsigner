export type StampType = 'signature' | 'initials' | 'text'

export const STAMP_SIZE: Record<StampType, { width: number; height: number }> = {
  signature: { width: 0.28, height: 0.08 },
  initials: { width: 0.12, height: 0.06 },
  text: { width: 0.4, height: 0.055 },
}

export interface Placement {
  id: string
  type: StampType
  pageIndex: number
  /** Normalized position (0–1) relative to page width, from left */
  x: number
  /** Normalized position (0–1) relative to page height, from top */
  y: number
  /** Normalized width (0–1) relative to page width */
  width: number
  /** Normalized height (0–1) relative to page height */
  height: number
  /** Typed content for text stamps */
  text?: string
}

export interface PageSize {
  width: number
  height: number
}
