export interface FileItem {
  id: string
  name: string
  kind: 'folder' | 'file'
  parentId: string | null
  mime?: string
  size?: number
  ownerId: string
  createdAt: string
  updatedAt: string
  /** legacy (demo seed): starred by the demo user — superseded by `starredBy` */
  starred?: boolean
  /** members who starred this item (stars are personal) */
  starredBy?: string[]
  sharedWith?: string[]
  url?: string // object URL for uploaded files
  trashed?: boolean
  /** Small persisted data-URL preview (uploaded images). */
  thumbnail?: string
  /** First few KB of an uploaded text / code file (persisted, for previews). */
  textPreview?: string
  /** Folder accent color (hex). */
  color?: string
  trashedAt?: string
  lastOpenedAt?: string
  description?: string
}

export type DriveSection = 'my' | 'shared' | 'recent' | 'starred' | 'trash'
export type SortKey = 'name' | 'updatedAt' | 'size' | 'owner'
