import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Shipping Policy | QuillFox',
  description: 'QuillFox Shipping Policy by TechyDez',
}

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-12">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold tracking-tight mb-4">Shipping Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-8 text-base leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Digital Delivery Only</h2>
            <p>
              QuillFox (a product of TechyDez) operates as a digital platform and software service. All features, access, and service provisions granted through our platform are 100% digital.
            </p>
            <p className="mt-4">
              <strong>We do not sell, ship, or deliver any physical goods.</strong> Therefore, no physical shipping takes place. 
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Instant Access</h2>
            <p>
              Upon successful payment or subscription via our payment gateways, access to the respective digital features on your QuillFox account is granted instantly. You will receive an email confirmation of your transaction.
            </p>
          </section>

          <section className="mt-8 border-t border-border/50 pt-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Contact Us</h2>
            <p>
              If you experience any issues accessing your digital purchase, please contact us immediately:
              <br /><br />
              <strong>Phone:</strong> <a href="tel:+447517879333" className="text-primary hover:underline">+447517879333</a><br />
              <strong>Email:</strong> <a href="mailto:hello@techydez.com" className="text-primary hover:underline">hello@techydez.com</a><br />
              <strong>Address:</strong> Jhelum, Punjab, Pakistan
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
