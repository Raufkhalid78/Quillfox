import type { Metadata } from 'next'
import { PricingContent } from '@/components/pricing/pricing-content'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, transparent pricing for QuillFox. Free, Premium and Ultra plans — all with end-to-end encryption by default.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing | QuillFox',
    description: 'Free, Premium and Ultra plans — all with end-to-end encryption by default.',
    url: '/pricing',
  },
}

export default function PricingPage() {
  return <PricingContent />
}