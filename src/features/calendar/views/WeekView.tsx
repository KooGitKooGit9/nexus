import { useMemo } from 'react'
import { addDays, startOfWeek } from 'date-fns'
import { TimeGrid, type TimeGridProps } from './TimeGrid'

export function WeekView({ date, ...rest }: Omit<TimeGridProps, 'days'> & { date: Date }) {
  const key = startOfWeek(date, { weekStartsOn: 0 }).getTime()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(key), i)), [key])
  return <TimeGrid days={days} {...rest} />
}
