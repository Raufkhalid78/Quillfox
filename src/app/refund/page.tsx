import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Refund & Cancellation Policy | QuillFox',
  description: 'QuillFox Refund and Cancellation Policy by TechyDez',
}

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-12">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold tracking-tight mb-4">Refund & Cancellation Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-8 text-base leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Cancellations</h2>
            <p>
              You can cancel your subscription at any time. Your cancellation will take effect at the end of the current paid term. 
              If you cancel, you will have continued access to the premium features of your subscription until the end of your billing cycle.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Refunds</h2>
            <p>
              We offer a 14-day money-back guarantee for all new subscriptions. If you are not satisfied with the Service, you can request a refund within 14 days of your initial purchase.
            </p>
            <p className="mt-4">
              <strong>Please note:</strong> All eligible refunds are subject to a 10% deduction from the original payment amount. This deduction covers mandatory payment processing fees and taxes (e.g., Safepay fees) that are non-refundable to us. Therefore, you will receive 90% of your original payment amount.
            </p>
            <p className="mt-4">
              To request a refund, please contact our support team at <a href="mailto:hello@techydez.com" className="text-primary hover:underline">hello@techydez.com</a>. Refunds will be processed to the original method of payment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Exceptional Circumstances</h2>
            <p>
              After 14 days, refunds may only be issued at our sole discretion under exceptional circumstances, such as prolonged service unavailability or critical security issues on our end. 
              Forgotten passwords or lost encryption keys do not qualify for a refund, as we cannot access or recover your data by design.
            </p>
          </section>

          <section className="mt-8 border-t border-border/50 pt-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Contact Information</h2>
            <p>
              For any questions regarding cancellations or refunds, please reach out to us:
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>Email: <a href="mailto:hello@techydez.com" className="text-primary hover:underline">hello@techydez.com</a></li>
              <li>Phone: <a href="tel:+447517879333" className="text-primary hover:underline">+447517879333</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
