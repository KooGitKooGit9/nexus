export type ElementType = 'sticky' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'path' | 'image' | 'frame'

export interface WbElement {
  id: string
  type: ElementType
  /** Top-left in world coords. For line/arrow: start point (end = x+w, y+h — w/h may be negative). */
  x: number
  y: number
  w: number
  h: number
  /** Fill color (hex) or undefined/'none'. Sticky background, shape fill, frame tint. */
  fill?: string
  /** Stroke/text color: hex or 'ink' (theme foreground). */
  stroke?: string
  strokeWidth?: number
  text?: string
  /** undefined → auto (sticky) / default */
  fontSize?: number
  /** Freehand points relative to (x, y), for 'path'. */
  points?: [number, number][]
  /** Image URL for 'image'. */
  src?: string
  /** Who created it (for collaborator attribution). */
  authorId?: string
  /** Visual tilt in degrees (sticky notes). */
  rotation?: number
  /** epoch ms — used for "pop in" animation on fresh elements. */
  bornAt?: number
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type TemplateId = 'blank' | 'brainstorm' | 'kpt' | 'journey' | 'mindmap'

export interface Board {
  id: string
  name: string
  emoji: string
  description?: string
  ownerId: string
  memberIds: string[]
  createdAt: string
  updatedAt: string
  starred?: boolean
  template?: TemplateId
  elements: WbElement[]
  viewport?: Viewport
}

export type Tool = 'select' | 'hand' | 'sticky' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text' | 'pen' | 'eraser' | 'image'
