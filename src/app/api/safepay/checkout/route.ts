import { NextResponse } from 'next/server'
import { Safepay } from '@sfpy/node-sdk'

export async function POST(req: Request) {
  try {
    const safepay = new Safepay({
      environment: (process.env.NODE_ENV === 'production' && process.env.SAFEPAY_API_KEY ? 'production' : 'sandbox') as any,
      apiKey: process.env.SAFEPAY_API_KEY || 'dummy',
      v1Secret: process.env.SAFEPAY_V1_SECRET || 'dummy',
      webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET || 'dummy',
    })

    const { tier, userId } = await req.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: missing userId' }, { status: 401 })
    }

    let planId = ''
    if (tier === 'premium') {
      planId = process.env.SAFEPAY_PLAN_PREMIUM_ID || ''
    } else if (tier === 'ultra') {
      planId = process.env.SAFEPAY_PLAN_ULTRA_ID || ''
    }

    if (!planId) {
      return NextResponse.json({ error: 'Plan configuration missing' }, { status: 400 })
    }

    // Safepay Subscription Link creation
    // The SDK provides safepay.subscriptions or similar (docs mention safepay.subscriptions.create)
    // We pass the user's ID as the reference so we can identify them in the webhook
    const subscriptionSession = await (safepay as any).subscription.create({
      planId: planId,
      reference: userId, // We use the user.id to track who is subscribing
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.quillfox.cc'}/dashboard/pricing?canceled=true`,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.quillfox.cc'}/dashboard/pricing?success=true`,
    })

    // subscriptionSession should contain a URL to redirect the user to
    // Safepay's subscription URLs usually are returned as `data.url` or `data.checkout_url`
    return NextResponse.json({ url: subscriptionSession.url || subscriptionSession.checkout_url || subscriptionSession.data?.url })
    
  } catch (error: any) {
    console.error('Safepay checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
