import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Heart, Network, Users, Palmtree, Wifi, Sparkles } from 'lucide-react'
import { Page } from '@/app/Page'
import { Button, PageHeader, UnderlineTabs, useLiveUsers } from '@/components/ui'
import { COMPANY } from '@/store/seed-users'
import { usePeople } from '../store'
import { useAllLeaves } from '../leaves'
import { isRecentKudos, leaveCovers } from '../lib'
import { MembersTab } from './MembersTab'
import { OrgChartTab } from './OrgChartTab'
import { AttendanceTab } from './AttendanceTab'
import { KudosTab } from './KudosTab'
import { GiveKudosModal } from '../components/GiveKudosModal'

type Tab = 'members' | 'org' | 'attendance' | 'kudos'
const TABS: Tab[] = ['members', 'org', 'attendance', 'kudos']

export function DirectoryView() {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'members'
  const [kudosOpen, setKudosOpen] = useState(false)
  const users = useLiveUsers()
  const kudos = usePeople((s) => s.kudos)
  const leaves = useAllLeaves()

  useEffect(() => {
    if (params.get('new') === '1') {
      setKudosOpen(true)
      const p = new URLSearchParams(params)
      p.delete('new')
      setParams(p, { replace: true })
    }
  }, [params, setParams])

  const setTab = (t: Tab) => {
    const p = new URLSearchParams(params)
    if (t === 'members') p.delete('tab')
    else p.set('tab', t)
    setParams(p, { replace: true })
  }

  const stats = useMemo(() => {
    const now = new Date()
    return [
      { label: '전체 구성원', value: users.length, icon: <Users className="h-4 w-4" />, color: '#8b5cf6' },
      { label: '지금 온라인', value: users.filter((u) => u.presence === 'online').length, icon: <Wifi className="h-4 w-4" />, color: '#34d399' },
      { label: '오늘 부재', value: new Set(leaves.filter((l) => leaveCovers(l, now)).map((l) => l.userId)).size, icon: <Palmtree className="h-4 w-4" />, color: '#f472b6' },
      { label: '최근 30일 칭찬', value: kudos.filter((k) => isRecentKudos(k.createdAt, now)).length, icon: <Sparkles className="h-4 w-4" />, color: '#fbbf24' },
    ]
  }, [users, leaves, kudos])

  return (
    <Page wide>
      <PageHeader
        icon={<Users />}
        title="구성원"
        subtitle={`${COMPANY.nameKo} · 함께 일하는 ${users.length}명의 동료들`}
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Network className="h-4 w-4" />} onClick={() => setTab('org')}>조직도</Button>
            <Button variant="primary" size="sm" leftIcon={<Heart className="h-4 w-4" />} onClick={() => setKudosOpen(true)}>칭찬하기</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass relative overflow-hidden rounded-2xl px-4 py-3"
            >
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl" style={{ background: s.color }} />
              <div className="relative flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
                <div>
                  <div className="font-display text-2xl font-bold leading-none tabular-nums text-fg">{s.value}</div>
                  <div className="mt-1 text-[11px] text-muted">{s.label}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </PageHeader>

      <UnderlineTabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'members', label: '구성원', icon: <Users />, count: users.length },
          { value: 'org', label: '조직도', icon: <Network /> },
          { value: 'attendance', label: '근태', icon: <Clock /> },
          { value: 'kudos', label: '칭찬 보드', icon: <Heart />, count: kudos.length },
        ]}
      />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {tab === 'members' && <MembersTab />}
          {tab === 'org' && <OrgChartTab />}
          {tab === 'attendance' && <AttendanceTab />}
          {tab === 'kudos' && <KudosTab onGive={() => setKudosOpen(true)} />}
        </motion.div>
      </AnimatePresence>

      <GiveKudosModal open={kudosOpen} onClose={() => setKudosOpen(false)} />
    </Page>
  )
}
