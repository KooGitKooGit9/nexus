import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { BRAND } from '@/config/brand'
import { Backdrop } from '../../components/Backdrop'
import { DemoButton } from '../../components/DemoButton'
import { ProductMockup } from './ProductMockup'

const ease = [0.22, 1, 0.36, 1] as const

export function Hero({ reduce }: { reduce: boolean }) {
  const up = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.6, ease } })
  return (
    <section className="relative isolate overflow-hidden px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-16">
      <Backdrop reduce={reduce} intensity={1.15} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-bg" />

      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div {...up(0.05)} className="inline-flex max-w-full items-center gap-2 rounded-full border border-line/10 bg-surface/60 py-1 pl-1 pr-3 text-[12.5px] font-medium text-muted backdrop-blur">
            <span className="rounded-full bg-accent-gradient px-2 py-0.5 text-[11px] font-semibold text-white">AI</span>
            <span className="truncate">일을 대신 처리하는 AI 비서까지, 한 워크스페이스에</span>
          </motion.div>

          <motion.h1 {...up(0.12)} className="mt-6 font-display text-[34px] font-bold leading-[1.08] tracking-tight break-keep sm:text-5xl md:text-[64px]">
            흩어진 업무 도구,
            <br />
            이제 <span className="gradient-text bg-[length:200%_auto] animate-gradient-x motion-reduce:animate-none">{BRAND.name} 하나로</span>
          </motion.h1>

          <motion.p {...up(0.2)} className="mx-auto mt-6 max-w-2xl text-[16.5px] leading-relaxed text-muted break-keep md:text-[18.5px]">
            <b className="font-semibold text-fg">{BRAND.tagline}.</b> 탭을 오가며 잃어버리던 맥락을 한곳에 모으고, 반복 업무는 AI와 자동화에 맡기세요.
          </motion.p>

          <motion.div {...up(0.28)} className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-start">
            <Link to="/signup" className="focus-ring group rounded-2xl">
              <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-accent-gradient px-6 text-[15px] font-semibold text-white shadow-glow transition hover:brightness-110 sm:w-auto">
                무료로 시작하기
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <DemoButton className="w-full sm:w-auto" />
          </motion.div>

          <motion.ul {...up(0.36)} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted">
            {['카드 등록 없이 시작', '멤버 10명까지 무료', '설치 없이 브라우저에서'].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" />{t}</li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.9, ease }}
          className="relative mx-auto mt-14 max-w-5xl md:mt-16"
        >
          <ProductMockup reduce={reduce} />
        </motion.div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12px] text-subtle">
          <Sparkles className="h-3.5 w-3.5" /> 화면의 이름과 데이터는 예시예요.
        </p>
      </div>
    </section>
  )
}
