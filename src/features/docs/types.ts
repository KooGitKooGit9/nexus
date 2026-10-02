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
  starred?: boolean
  tags?: string[]
  /** Per-user permission overrides (share popover). */
  permissions?: Record<string, DocPermission>
  /** Anyone in the workspace with the link can view. */
  linkShared?: boolean
}
