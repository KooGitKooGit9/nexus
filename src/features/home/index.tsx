import { Page } from '@/app/Page'
import { Hero } from './components/Hero'
import { QuickActions } from './components/QuickActions'
import { TodayEvents } from './widgets/TodayEvents'
import { MyTasks } from './widgets/MyTasks'
import { PendingApprovals } from './widgets/PendingApprovals'
import { Mentions } from './widgets/Mentions'
import { TeamStatus } from './widgets/TeamStatus'
import { ProductivityChart } from './widgets/ProductivityChart'
import { OkrWidget } from './widgets/OkrWidget'
import { LatestAnnouncement } from './widgets/LatestAnnouncement'
import { Celebrations } from './widgets/Celebrations'
import { FocusTimer } from './widgets/FocusTimer'
import { QuickNote } from './widgets/QuickNote'
import { ActivityFeed } from './widgets/ActivityFeed'

/**
 * Column count follows the *viewport*, but the content area also depends on the sidebar
 * (248px expanded ≥1024px, 72px rail below) — so 3/4 columns only kick in once each column is ≥ ~300px.
 * Spans: WIDE = full on md (2 cols), 2/3 on xl (3 cols), half on 2xl (4 cols).
 */
const WIDE = 'md:col-span-2'
const FULL = 'md:col-span-2 xl:col-span-3 2xl:col-span-4'

export default function HomePage() {
  return (
    <Page wide>
      <div className="space-y-6">
        <Hero />
        <QuickActions />

        <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <TodayEvents className={WIDE} delay={0.2} />
          <MyTasks className={WIDE} delay={0.26} />

          <ProductivityChart className={WIDE} delay={0.32} />
          <FocusTimer delay={0.36} />
          <PendingApprovals delay={0.4} />

          <OkrWidget className={WIDE} delay={0.44} />
          <LatestAnnouncement delay={0.48} />
          <TeamStatus delay={0.52} />

          <Mentions className={WIDE} delay={0.56} />
          <Celebrations delay={0.6} />
          <QuickNote delay={0.64} />

          <ActivityFeed className={FULL} delay={0.68} />
        </div>
      </div>
    </Page>
  )
}
