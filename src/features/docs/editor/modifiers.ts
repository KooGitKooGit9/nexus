import type { Modifier } from '@dnd-kit/core'

/** Local copy of @dnd-kit/modifiers' restrictToVerticalAxis (package not installed). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })
