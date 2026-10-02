export type DocPermission = 'full' | 'edit' | 'comment' | 'view'

export interface Doc {
  id: string
  parentId: string | null
  title: string
  emoji: string
  cover?: string // CSS gradient string
  content: string // markdown
  authorId: string
  lastEditedBy: string
  createdAt: string
  updatedAt: string
  /** legacy (demo seed): starred by the demo user — superseded by `starredBy` */
  starred?: boolean
  /** members who starred this page (stars are personal) */
  starredBy?: string[]
  tags?: string[]
  /** Per-user permission overrides (share popover). */
  permissions?: Record<string, DocPermission>
  /** Anyone in the workspace with the link can view. */
  linkShared?: boolean
}
