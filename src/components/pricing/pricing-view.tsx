'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { supabase } from '@/lib/supabase'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  Check,
  Crown,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Users,
  Zap,
  Shield,
  Sparkles,
  Infinity,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { useTheme } from 'next-themes'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
}

interface PlanFeature {
  text: string
  included: boolean
  highlight?: boolean
}

interface Plan {
  id: string
  name: string
  subtitle: string
  price: string
  priceLabel: string
  badge?: string
  badgeColor?: string
  icon: typeof Crown
  iconGradient: string
  iconBg: string
  features: PlanFeature[]
  cta: string
  ctaVariant: 'outline' | 'default'
  ctaGradient?: string
  borderColor?: string
  popular?: boolean
  cardGlow?: string
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Get started with essentials',
    price: '$0',
    priceLabel: 'forever',
    icon: Zap,
    iconGradient: 'from-[#059669] to-[#0d9488]',
    iconBg: 'bg-[#059669]/10 dark:bg-[#059669]/20',
    features: [
      { text: '2 active devices', included: true },
      { text: 'Up to 2 collaborators', included: true },
      { text: '10 notes max', included: true },
      { text: '3 todo lists max', included: true },
      { text: '1 workspace', included: true },
      { text: 'Basic encryption', included: true },
      { text: 'Priority support', included: false },
      { text: 'Custom themes', included: false },
    ],
    cta: 'Current Plan',
    ctaVariant: 'outline',
    borderColor: 'border-border/50',
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'For power users & small teams',
    price: '$7',
    priceLabel: '/month',
    badge: 'POPULAR',
    badgeColor: 'bg-[#d97706] text-white',
    icon: Crown,
    iconGradient: 'from-[#d97706] to-[#f59e0b]',
    iconBg: 'bg-[#d97706]/10 dark:bg-[#d97706]/20',
    features: [
      { text: 'Up to 3 devices', included: true, highlight: true },
      { text: 'Up to 15 collaborators', included: true, highlight: true },
      { text: '+$5/mo per 10 extra collaborators', included: true },
      { text: 'Unlimited notes', included: true },
      { text: 'Unlimited todo lists', included: true },
      { text: '10 workspaces', included: true },
      { text: 'E2E encryption', included: true },
      { text: 'Priority support', included: true },
      { text: 'Custom themes', included: false },
    ],
    cta: 'Upgrade to Premium',
    ctaVariant: 'default',
    ctaGradient: 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white hover:from-[#d97706]/90 hover:to-[#f59e0b]/90',
    borderColor: 'border-[#d97706]/30',
    popular: true,
    cardGlow: 'shadow-lg shadow-[#d97706]/10',
  },
  {
    id: 'ultra',
    name: 'Ultra Premium',
    subtitle: 'For teams & organizations',
    price: '$17',
    priceLabel: '/month',
    badge: 'BEST VALUE',
    badgeColor: 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white',
    icon: Sparkles,
    iconGradient: 'from-[#7c3aed] to-[#a855f7]',
    iconBg: 'bg-[#7c3aed]/10 dark:bg-[#7c3aed]/20',
    features: [
      { text: 'Up to 5 devices', included: true, highlight: true },
      { text: 'Up to 35 collaborators', included: true, highlight: true },
      { text: '+$5/mo per 10 extra collaborators', included: true },
      { text: 'Unlimited notes', included: true },
      { text: 'Unlimited todo lists', included: true },
      { text: 'Unlimited workspaces', included: true },
      { text: 'Advanced E2E encryption', included: true },
      { text: 'Priority support', included: true },
      { text: 'Custom themes & branding', included: true },
    ],
    cta: 'Upgrade to Ultra',
    ctaVariant: 'default',
    ctaGradient: 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white hover:from-[#7c3aed]/90 hover:to-[#a855f7]/90',
    borderColor: 'border-[#7c3aed]/30',
    cardGlow: 'shadow-lg shadow-[#7c3aed]/10',
  },
]

export function PricingView() {
  const currentUser = useAppStore((s) => s.currentUser)
  const setView = useAppStore((s) => s.setView)
  const logout = useAppStore((s) => s.logout)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const setTier = useAppStore((s) => s.setTier)
  const userTier = useAppStore((s) => s.userTier)
  const { theme, setTheme } = useTheme()

  const [billingOpen, setBillingOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [annualToggle, setAnnualToggle] = useState(false)

  useEffect(() => {
    if (!currentUser) setView('auth')
  }, [currentUser, setView])

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === userTier) {
      toast.success(`You are already on the ${plan.name} plan`)
      return
    }
    setSelectedPlan(plan)
    setBillingOpen(true)
  }

  const handleConfirmUpgrade = async () => {
    if (!currentUser || !selectedPlan) return
    setIsProcessing(true)
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 1500))
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tier: selectedPlan.id })
        .eq('id', currentUser.id)

      if (error) {
        console.warn("DB update failed, using local simulation:", error.message)
      }
      setTier(selectedPlan.id as 'free' | 'premium' | 'ultra')
      
      if (selectedPlan.id === 'free') {
        toast.success('Subscription downgraded to Free plan!')
      } else {
        toast.success(`${selectedPlan.name} plan activated!`)
      }
    } catch {
      setTier(selectedPlan.id as 'free' | 'premium' | 'ultra')
      if (selectedPlan.id === 'free') {
        toast.success('Subscription downgraded to Free plan! (local simulation)')
      } else {
        toast.success(`${selectedPlan.name} plan activated! (local simulation)`)
      }
    } finally {
      setIsProcessing(false)
      setBillingOpen(false)
    }
  }

  const getAnnualPrice = (price: string) => {
    const monthly = parseFloat(price.replace('$', ''))
    const annual = (monthly * 12 * 0.8).toFixed(2) // 20% discount
    return `$${annual}`
  }

  if (!currentUser) return null

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar activeView="pricing" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('dashboard')}
              className="shrink-0 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#d97706]" />
              <h1 className="text-sm font-semibold tracking-tight">Pricing Plans</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">

            {/* Hero Section */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center mb-10 md:mb-14">
              <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d97706] to-[#f59e0b] text-white flex items-center justify-center shadow-lg shadow-[#d97706]/20">
                  <Crown className="w-5 h-5" />
                </div>
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-2xl md:text-4xl font-bold tracking-tight mb-2">
                Choose Your Plan
              </motion.h2>
              <motion.p variants={fadeUp} className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto mb-6">
                Unlock the full power of QuillFox. Upgrade anytime as your needs grow.
              </motion.p>

              {/* Annual/Monthly Toggle */}
              <motion.div variants={fadeUp} className="flex items-center justify-center gap-3">
                <span className={`text-xs font-medium transition-colors ${!annualToggle ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Monthly
                </span>
                <button
                  onClick={() => setAnnualToggle(!annualToggle)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                    annualToggle
                      ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7]'
                      : 'bg-muted'
                  }`}
                >
                  <motion.div
                    className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    animate={{ x: annualToggle ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
                <span className={`text-xs font-medium transition-colors ${annualToggle ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Annual
                </span>
                {annualToggle && (
                  <Badge className="bg-[#059669]/10 text-[#059669] border-[#059669]/20 text-[10px] font-medium">
                    Save 20%
                  </Badge>
                )}
              </motion.div>
            </motion.div>

            {/* Plans Grid */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {plans.map((plan) => {
                const IconComp = plan.icon
                const displayPrice = plan.price === '$0' ? plan.price : annualToggle ? getAnnualPrice(plan.price) : plan.price
                const displayLabel = plan.price === '$0' ? plan.priceLabel : annualToggle ? '/year' : plan.priceLabel

                return (
                  <motion.div key={plan.id} variants={fadeUp}>
                    <div
                      className={`relative rounded-2xl border ${plan.borderColor} bg-card/60 backdrop-blur-sm p-6 md:p-7 transition-all duration-300 hover:-translate-y-1 ${plan.cardGlow || 'hover:shadow-lg hover:shadow-black/5'} h-full flex flex-col`}
                    >
                      {/* Plan Badge */}
                      {plan.badge && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className={`${plan.badgeColor} text-[10px] font-semibold tracking-wide shadow-md px-3`}>
                            {plan.badge}
                          </Badge>
                        </div>
                      )}

                      {/* Plan Icon */}
                      <div className={`w-11 h-11 rounded-xl ${plan.iconBg} flex items-center justify-center mb-4`}>
                        <div className={`w-5 h-5 bg-gradient-to-br ${plan.iconGradient} rounded-md`} />
                      </div>

                      {/* Plan Name */}
                      <div className="mb-1">
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground">{plan.subtitle}</p>
                      </div>

                      {/* Price */}
                      <div className="mt-4 mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl md:text-4xl font-extrabold tracking-tight">{displayPrice}</span>
                          <span className="text-sm text-muted-foreground">{displayLabel}</span>
                        </div>
                      </div>

                      {/* CTA Button */}
                      {(() => {
                        const isActive = userTier === plan.id
                        let ctaText = 'Upgrade'
                        let ctaVariant: 'outline' | 'default' = 'default'
                        let ctaGradient = plan.ctaGradient || ''
                        let isDisabled = false

                        if (isActive) {
                          ctaText = 'Current Plan'
                          ctaVariant = 'outline'
                          ctaGradient = ''
                          isDisabled = true
                        } else {
                          if (plan.id === 'free') {
                            ctaText = 'Downgrade to Free'
                            ctaVariant = 'outline'
                            ctaGradient = 'hover:bg-accent hover:text-accent-foreground border-border/60'
                          } else if (plan.id === 'premium') {
                            ctaText = userTier === 'ultra' ? 'Downgrade to Premium' : 'Upgrade to Premium'
                            ctaVariant = userTier === 'ultra' ? 'outline' : 'default'
                            if (userTier === 'ultra') {
                              ctaGradient = 'border-[#d97706]/50 text-[#d97706] hover:bg-[#d97706]/10'
                            }
                          } else if (plan.id === 'ultra') {
                            ctaText = 'Upgrade to Ultra'
                            ctaVariant = 'default'
                          }
                        }

                        return (
                          <Button
                            className={`w-full rounded-xl h-10 text-sm font-semibold mb-6 ${ctaGradient}`}
                            variant={ctaVariant}
                            onClick={() => handleSelectPlan(plan)}
                            disabled={isDisabled}
                          >
                            {ctaText}
                          </Button>
                        )
                      })()}

                      {/* Features */}
                      <div className="space-y-3 flex-1">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">What&apos;s included</p>
                        <ul className="space-y-2.5">
                          {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              {feature.included ? (
                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${feature.highlight ? 'bg-[#059669]/15 dark:bg-[#059669]/25' : 'bg-muted/80'}`}>
                                  <Check className={`w-2.5 h-2.5 ${feature.highlight ? 'text-[#059669]' : 'text-muted-foreground'}`} />
                                </div>
                              ) : (
                                <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-muted/50">
                                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                </div>
                              )}
                              <span className={`text-xs leading-relaxed ${feature.included ? 'text-foreground' : 'text-muted-foreground/50 line-through'}`}>
                                {feature.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Bottom comparison banner */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mt-10 md:mt-14">
              <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                      <Shield className="w-5 h-5 text-[#059669]" />
                      <h3 className="text-base font-bold">All plans include security you can trust</h3>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Every plan comes with encrypted data storage, secure sharing, and reliable backups. Your data stays yours.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <Monitor className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-semibold">Multi-device</p>
                      <p className="text-[10px] text-muted-foreground">Sync everywhere</p>
                    </div>
                    <div>
                      <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-semibold">Collaborate</p>
                      <p className="text-[10px] text-muted-foreground">Real-time</p>
                    </div>
                    <div>
                      <Infinity className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-semibold">Unlimited</p>
                      <p className="text-[10px] text-muted-foreground">Storage</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* FAQ Section */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mt-10 md:mt-14 mb-4">
              <h3 className="text-lg font-bold text-center mb-6">Frequently Asked Questions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {[
                  { q: 'Can I switch plans anytime?', a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.' },
                  { q: 'Is there a free trial?', a: 'The Free plan is available forever with basic features. No credit card required.' },
                  { q: 'What payment methods are accepted?', a: 'We accept all major credit cards, PayPal, and bank transfers for annual plans.' },
                  { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel your subscription at any time with no cancellation fees.' },
                ].map((faq, i) => (
                  <div key={i} className="rounded-xl border border-border/40 bg-card/40 p-4">
                    <p className="text-xs font-semibold mb-1">{faq.q}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const isUpgrade = selectedPlan ? (
              (userTier === 'free') || 
              (userTier === 'premium' && selectedPlan.id === 'ultra')
            ) : true

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-[#d97706]" />
                    {isUpgrade ? `Upgrade to ${selectedPlan?.name}` : `Downgrade to ${selectedPlan?.name}`}
                  </DialogTitle>
                  <DialogDescription>
                    {isUpgrade 
                      ? 'Confirm your plan upgrade to unlock all premium features.'
                      : 'Confirm your plan downgrade. Some premium features may become locked.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {/* Plan Summary */}
                  <div className="rounded-xl border border-border/50 p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{selectedPlan?.name}</span>
                      <span className="text-lg font-bold">
                        {selectedPlan?.price === '$0' ? selectedPlan.price : annualToggle ? getAnnualPrice(selectedPlan?.price ?? '$0') : selectedPlan?.price}
                        <span className="text-xs text-muted-foreground font-normal ml-1">
                          {selectedPlan?.price === '$0' ? '' : annualToggle ? '/year' : '/month'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedPlan?.features.filter(f => f.included).slice(0, 3).map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="w-3 h-3 text-[#059669]" />
                          <span>{f.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="rounded-xl border border-border/50 p-4 bg-muted/30">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      This is a demo environment. No actual payment will be processed. In production, you would be redirected to a secure payment gateway.
                    </p>
                  </div>

                  <Button
                    className={`w-full rounded-xl h-10 font-semibold ${selectedPlan?.ctaGradient}`}
                    onClick={handleConfirmUpgrade}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'
                    )}
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
