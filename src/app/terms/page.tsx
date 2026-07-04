import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | QuillFox',
  description: 'QuillFox Terms of Service by TechyDez',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-12">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-8 text-base leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using QuillFox ("Service"), a product by <strong>TechyDez</strong>, you agree to be bound by these Terms. 
              If you disagree with any part of the terms, then you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Account Responsibility & Encryption</h2>
            <p>
              QuillFox utilizes end-to-end encryption. You are solely responsible for safeguarding the password that you use to access the Service. 
              <strong>TechyDez cannot recover your master password or your encrypted data if you lose your password.</strong> 
              You agree not to disclose your password to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Subscriptions and Billing</h2>
            <p>
              Some parts of the Service are billed on a subscription basis ("Premium", "Ultra"). You will be billed in advance on a recurring and periodic basis. 
              We reserve the right to refuse or cancel your order if fraud or an unauthorized or illegal transaction is suspected.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Acceptable Use</h2>
            <p>
              You agree not to use the Service to store or transmit any unlawful, threatening, libelous, defamatory, obscene, or pornographic material. 
              While we cannot read your data due to encryption, we reserve the right to terminate your account if we discover violations of this policy through metadata or user reports.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">5. Limitation of Liability</h2>
            <p>
              In no event shall TechyDez, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, 
              incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, 
              or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
