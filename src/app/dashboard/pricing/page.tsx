'use client'

import { Suspense } from 'react'
import { PricingView } from '@/components/pricing/pricing-view'

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PricingView />
    </Suspense>
  )
}

