import type { ReactNode } from 'react'
import {
  CalendarDays, Check, FileText, FolderOpen, Headphones, KanbanSquare, LayoutGrid, Megaphone, MessagesSquare, Mic, MonitorUp, PenTool, Stamp,
  Target, Users, Video, Workflow, Zap, type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Face, Reveal, Section } from './ui'

function FeatureCard({ icon: Icon, title, desc, points, children, className, tone = 'from-accent to-accent-2', delay = 0 }: {
  icon: LucideIcon
  title: string
  desc: string
  points?: string[]
  children?: ReactNode
  className?: string
  tone?: string
  delay?: number
}) {
  return (
    <Reveal delay={delay} className={cn('min-w-0', className)}>
      <Card spotlight hover className="flex h-full flex-col rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-glow-sm', tone)}>
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-muted break-keep">{desc}</p>
        {points && (
          <ul className="mt-3 space-y-1.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-fg/80"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />{p}</li>
            ))}
          </ul>
        )}
        {children && <div aria-hidden className="mt-5 flex-1">{children}</div>}
      </Card>
    </Reveal>
  )
}

function CallTiles() {
  const people = ['김하늘', '이도윤', '박서연', '최민준']
  return (
    <div className="grid grid-cols-2 gap-2">
      {people.map((n, i) => (
        <div key={n} className={cn('relative flex h-20 items-center justify-center rounded-xl border bg-gradient-to-br from-surface-2 to-surface-3', i === 1 ? 'border-success/60 shadow-[0_0_0_2px_rgb(var(--success)/0.25)]' : 'border-line/10')}>
          <Face name={n} size={34} />
          <span className="absolute bottom-1.5 left-2 flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] text-white">
            {i === 2 ? <MonitorUp className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}{n}
          </span>
        </div>
      ))}
    </div>
  )
}

function MiniKanban() {
  const cols = [
    { n: '할 일', c: 'bg-line/30', items: ['온보딩 개선', '요금제 문구'] },
    { n: '진행 중', c: 'bg-accent', items: ['결제 연동', 'QA'] },
    { n: '완료', c: 'bg-success', items: ['랜딩 페이지'] },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map((col) => (
        <div key={col.n} className="rounded-xl bg-line/[0.04] p-2">
          <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-muted"><span className={cn('h-1.5 w-1.5 rounded-full', col.c)} />{col.n}</div>
          {col.items.map((it) => (
            <div key={it} className="mb-1.5 rounded-lg border border-line/10 bg-surface px-2 py-1.5 text-[10.5px] shadow-card">{it}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function MiniFlow() {
  const nodes = [
    { t: '트리거', n: '결재 최종 승인', c: 'border-accent/40 bg-accent/10 text-accent' },
    { t: '조건', n: '금액 ≥ 100만원', c: 'border-warning/40 bg-warning/10 text-warning' },
    { t: '액션', n: '#재무팀에 알림', c: 'border-success/40 bg-success/10 text-success' },
  ]
  return (
    <div className="flex flex-col items-start gap-1.5">
      {nodes.map((nd, i) => (
        <div key={nd.n} className="flex w-full flex-col items-start" style={{ paddingLeft: i * 18 }}>
          <div className={cn('rounded-xl border px-3 py-1.5 text-[11.5px]', nd.c)}>
            <span className="mr-1.5 text-[10px] font-bold opacity-80">{nd.t}</span>
            <span className="font-medium text-fg">{nd.n}</span>
          </div>
          {i < nodes.length - 1 && <span className="ml-5 h-2.5 w-px bg-line/25" />}
        </div>
      ))}
    </div>
  )
}

export function Features() {
  return (
    <Section
      id="features"
      eyebrow={<><LayoutGrid />주요 기능</>}
      title={<>팀이 일하는 모든 순간을<br className="hidden sm:block" /> <span className="gradient-text">한 화면에서</span></>}
      lead="지금 바로 쓸 수 있는 기능들이에요. 모든 기능이 서로 연결돼 있어서, 메시지에서 태스크를 만들고 일정에서 문서를 열 수 있어요."
    >
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          className="lg:col-span-2"
          icon={MessagesSquare}
          title="메신저 · 허들 · 통화"
          desc="채널과 DM, 스레드, 멘션까지. 대화하다 바로 허들을 열거나 음성·영상 통화로 전환하고 화면을 공유하세요."
          points={['채널 · DM · 스레드 · @멘션', '허들과 음성/영상 통화, 화면 공유', '파일 첨부 · 이모지 반응']}
        >
          <CallTiles />
        </FeatureCard>
        <FeatureCard icon={KanbanSquare} title="프로젝트 · 칸반" tone="from-info to-accent-2" delay={0.05}
          desc="칸반 보드, 리스트, 타임라인으로 같은 일을 원하는 방식으로 봐요. 담당자·마감·우선순위와 진행 인사이트까지.">
          <MiniKanban />
        </FeatureCard>

        <FeatureCard icon={FileText} title="문서 · 위키" tone="from-accent-3 to-accent"
          desc="슬래시(/) 명령으로 제목, 체크리스트, 표, 이미지를 넣는 블록 에디터. 템플릿으로 회의록과 기획서를 빠르게." />
        <FeatureCard icon={CalendarDays} title="캘린더" tone="from-success to-accent-2" delay={0.05}
          desc="팀 일정과 회의를 한눈에. 한국 공휴일·대체공휴일이 기본으로 표시되고, 시작 전에 알림을 보내드려요." />
        <FeatureCard icon={FolderOpen} title="드라이브" tone="from-warning to-accent-3" delay={0.1}
          desc="폴더로 정리하고 미리보기로 바로 확인하는 파일 공간. 워크스페이스 멤버만 내려받을 수 있어요." />

        <FeatureCard icon={Workflow} title="워크플로우 자동화" tone="from-accent-2 to-info"
          desc="메시지 수신, 태스크 상태 변경, 일정 시작, 결재, 스케줄(Cron)을 트리거로 조건과 액션을 연결하는 비주얼 에디터. HTTP 요청으로 외부 서비스도 호출해요."
        >
          <MiniFlow />
        </FeatureCard>
        <FeatureCard icon={Stamp} title="전자결재" tone="from-danger to-accent-3" delay={0.05}
          desc="휴가·경비·구매·출장 양식으로 상신하고, 결재선을 지정해 승인·반려까지. 결재 결과는 알림으로 바로 받아요."
          points={['결재선 지정 · 순차 승인', '승인/반려 사유 기록', '자동화 트리거와 연동']} />
        <FeatureCard icon={PenTool} title="화이트보드" tone="from-accent to-accent-3" delay={0.1}
          desc="무한 캔버스에 도형, 스티키 메모, 연결선을 올려 함께 아이디어를 펼쳐요. 회고·브레인스토밍 템플릿 제공." />

        <FeatureCard icon={Target} title="OKR · 목표" tone="from-success to-info"
          desc="회사·팀 목표와 핵심 결과를 세우고 체크인으로 진척도를 추적해요. 정렬 트리로 목표가 어떻게 이어지는지 한눈에." />
        <FeatureCard icon={Megaphone} title="공지" tone="from-warning to-danger" delay={0.05}
          desc="공지를 올리면 모두에게 알림이 가고, 상단 고정과 읽음 확인으로 중요한 소식이 채팅 속에 묻히지 않아요." />
        <FeatureCard icon={Users} title="구성원 디렉터리" tone="from-info to-accent" delay={0.1}
          desc="동료의 프로필, 상태, 근무 정보와 휴가 현황을 찾고, 칭찬 카드로 고마움을 전하세요." />
      </div>

      <Reveal className="mt-4">
        <div className="flex flex-col items-start gap-4 rounded-3xl border border-line/10 bg-surface/50 p-5 backdrop-blur sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-line/[0.06] text-accent"><Zap className="h-5 w-5" /></span>
          <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-muted break-keep">
            <b className="text-fg">⌘K 하나로 어디든.</b> 메시지·태스크·문서·일정·파일을 한 번에 검색하고, 모든 알림은 하나의 알림함에 모여요. 라이트/다크 테마와 키보드 단축키도 기본이에요.
          </p>
          <span className="hidden items-center gap-1.5 text-[12px] text-subtle sm:flex"><Headphones className="h-3.5 w-3.5" /><Video className="h-3.5 w-3.5" /> 브라우저만 있으면 OK</span>
        </div>
      </Reveal>
    </Section>
  )
}
