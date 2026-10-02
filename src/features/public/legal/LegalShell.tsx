import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { BRAND, isLegalDraft } from '@/config/brand'

export interface LegalSection { id: string; title: string; body: ReactNode }

/** Long-form legal document with a sticky table of contents. */
export function LegalShell({ title, intro, sections, other }: { title: string; intro: ReactNode; sections: LegalSection[]; other: { to: string; label: string } }) {
  return (
    <div className="px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      <div className="mx-auto max-w-5xl">
        {isLegalDraft() && (
          <div role="note" className="mb-8 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/[0.08] px-4 py-3.5 text-[13.5px]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 break-keep">
              <b className="text-warning">초안 — 출시 전 법률 검토가 필요합니다.</b>
              <span className="text-fg/80"> 사업자 정보([대괄호] 항목)를 채우고 전문가 검토를 받은 뒤 게시하세요.</span>
            </div>
          </div>
        )}
        <h1 className="font-display text-[34px] font-bold tracking-tight md:text-[44px]">{title}</h1>
        <p className="mt-2 text-[13.5px] text-subtle">시행일 {BRAND.legalEffectiveDate} · {BRAND.company.legalName}</p>
        <div className="mt-6 text-[15px] leading-[1.8] text-fg/85 break-keep">{intro}</div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="목차" className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-line/10 bg-surface/50 p-3 backdrop-blur">
              <div className="px-2 pb-2 text-[11.5px] font-semibold tracking-wide text-subtle">목차</div>
              <ol className="space-y-0.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="block rounded-lg px-2 py-1.5 text-[12.5px] leading-snug text-muted transition hover:bg-line/[0.05] hover:text-fg">{s.title}</a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <article className="legal-doc min-w-0 space-y-10">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-[19px] font-semibold tracking-tight text-fg">{s.title}</h2>
                <div className="mt-3 space-y-3 text-[14.5px] leading-[1.85] text-fg/80 break-keep [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_b]:text-fg [&_table]:w-full [&_td]:border [&_td]:border-line/10 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-line/10 [&_th]:bg-line/[0.04] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold">
                  {s.body}
                </div>
              </section>
            ))}
            <div className="border-t border-line/10 pt-6 text-[13.5px] text-muted">
              함께 보기: <Link to={other.to} className="font-semibold text-fg underline underline-offset-2 hover:text-accent">{other.label}</Link>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}

/** Horizontal-scroll wrapper so wide tables never overflow the page on phones. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl"><table className="min-w-[520px] text-[13.5px]">{children}</table></div>
}
