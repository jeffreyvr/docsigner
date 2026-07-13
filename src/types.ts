export type StampType = 'signature' | 'initials'

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
}

export interface PageSize {
  width: number
  height: number
}
