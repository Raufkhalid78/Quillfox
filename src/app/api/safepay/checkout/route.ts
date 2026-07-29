import { NextResponse } from 'next/server'
import Safepay from '@sfpy/node-core'

export async function POST(req: Request) {
  try {
    const isProd = process.env.NODE_ENV === 'production' && !!process.env.SAFEPAY_API_KEY;
    const environment = isProd ? 'production' : 'sandbox';
    const host = isProd ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com';
    
    // Ensure we have a secret key. In a real app, you would have different keys for dev/prod.
    const secretKey = process.env.SAFEPAY_API_KEY || 'sec_dummy_key_for_dev';

    const safepay = new Safepay(secretKey, {
      authType: 'secret',
      host: host,
    });

    const { tier, userId } = await req.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: missing userId' }, { status: 401 })
    }

    // Determine amount based on tier (assuming PKR)
    let amount = 0;
    if (tier === 'premium') {
      amount = 1500; // 1500 PKR
    } else if (tier === 'ultra') {
      amount = 4000; // 4000 PKR
    }

    if (!amount) {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 })
    }

    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/pricing?canceled=true`;
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/pricing?success=true`;

    // 1. Create a payment session (Tracker)
    const sessionResponse = await safepay.payments.session.setup({
      merchant_api_key: secretKey,
      intent: 'CYBERSOURCE',
      mode: 'payment',
      currency: 'PKR',
      amount: amount * 100, // Safepay typically expects amounts in the lowest denomination (paisa/cents)
    });

    const trackerToken = sessionResponse.data.token;

    // 2. Create an authentication token (Passport)
    // Sometimes passport creation is done for client-side, but Safepay Checkout URL needs `tbt`
    const passportResponse = await safepay.client.passport.create();
    const tbtToken = passportResponse.data.token;

    // 3. Generate the Checkout URL
    const checkoutUrl = safepay.checkout.createCheckoutUrl({
      env: environment,
      tracker: trackerToken,
      tbt: tbtToken,
      source: 'hosted',
      user_id: userId,
      cancel_url: cancelUrl,
      redirect_url: redirectUrl,
    });

    return NextResponse.json({ url: checkoutUrl })
    
  } catch (error: any) {
    console.error('Safepay checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
