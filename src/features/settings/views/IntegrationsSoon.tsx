import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plug, Globe } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { Badge, Button } from '@/components/ui'
import { SettingsSection } from '../components/Section'
import { IntegrationSettings } from './Integrations'

/** Demo workspaces keep the (clearly labelled) demo integrations; real workspaces get the honest version. */
export function IntegrationsTab() {
  const ws = useWorkspace()
  return ws.kind === 'demo' ? <IntegrationSettings /> : <IntegrationsSoon />
}

function IntegrationsSoon() {
  const navigate = useNavigate()
  return (
    <SettingsSection title={<span className="flex items-center gap-2">외부 서비스 연동<Badge>곧 제공</Badge></span>} icon={<Plug />} description="자주 쓰는 외부 서비스와의 원클릭 연동을 준비하고 있어요.">
      <p className="text-[13.5px] leading-relaxed text-muted break-keep">지금은 자동화 워크플로우의 HTTP 요청 액션으로 다른 서비스에 데이터를 보낼 수 있어요.</p>
      <div className="mt-4 rounded-2xl border border-line/10 bg-line/[0.03] p-4">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold"><Globe className="h-4 w-4 text-accent" />HTTP 요청 액션</div>
        <p className="mt-1.5 text-[12.5px] text-muted break-keep">메시지 수신, 태스크 상태 변경, 결재, 스케줄 같은 트리거가 일어나면 외부 API로 데이터를 보내요.</p>
      </div>
      <Button className="mt-4" size="sm" variant="primary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate('/workflows')}>자동화 만들러 가기</Button>
    </SettingsSection>
  )
}
