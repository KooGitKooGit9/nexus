import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReduce } from '../lib'
import { Hero } from './landing/Hero'
import { Consolidation } from './landing/Consolidation'
import { Features } from './landing/Features'
import { AiSection, FinalCta, LandingFaq, PricingTeaser, SecuritySection } from './landing/More'

export function Landing() {
  const reduce = useReduce()
  const location = useLocation()
  const navigate = useNavigate()

  // Section links from other pages navigate here with `state.scrollTo`.
  useEffect(() => {
    const id = (location.state as { scrollTo?: string } | null)?.scrollTo
    if (!id) return
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      navigate('.', { replace: true, state: null })
    }, 60)
    return () => clearTimeout(t)
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Hero reduce={reduce} />
      <Consolidation reduce={reduce} />
      <Features />
      <AiSection reduce={reduce} />
      <SecuritySection />
      <PricingTeaser />
      <LandingFaq />
      <FinalCta reduce={reduce} />
    </>
  )
}
