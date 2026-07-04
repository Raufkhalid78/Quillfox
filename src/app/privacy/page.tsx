import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | QuillFox',
  description: 'QuillFox Privacy Policy by TechyDez',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-12">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-8 text-base leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Introduction</h2>
            <p>
              Welcome to QuillFox, a product proudly developed by <strong>TechyDez</strong>. 
              We are committed to protecting your personal information and your right to privacy. 
              Our core product is built on Zero-Knowledge architecture, meaning we prioritize your privacy by design.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Zero-Knowledge Encryption</h2>
            <p>
              QuillFox employs end-to-end encryption for your notes and tasks. Your data is encrypted locally on your device 
              using a key derived from your master password. <strong>TechyDez does not have access to your master password or your decryption keys.</strong> 
              Consequently, we cannot read, analyze, or hand over your encrypted vault data to any third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Data We Collect</h2>
            <p className="mb-4">While we cannot read your encrypted vault, we do collect necessary metadata to provide the service:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Email address, billing details (if applicable), and your user profile name.</li>
              <li><strong>Usage Data:</strong> Device counts, active session limits, and aggregate analytics to monitor service health.</li>
              <li><strong>Encrypted Blobs:</strong> The encrypted ciphertext of your notes and tasks, stored securely on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Sharing Your Information</h2>
            <p>
              We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. 
              We use third-party payment processors (e.g., Stripe) to handle billing, who are governed by their own strict privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">5. Contact Us</h2>
            <p>
              If you have questions or comments about this policy, you may email us at privacy@techydez.com or by post to:
              <br /><br />
              TechyDez<br />
              123 Privacy Lane<br />
              Secure City, SC 12345
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
