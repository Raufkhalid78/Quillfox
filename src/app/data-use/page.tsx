import React from 'react';
import { Shield, Key } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DataUsePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tighter">QuillFox</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-white/70 hover:text-white">Back Home</Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold mb-8">Google OAuth Data Use Policy</h1>
        <div className="space-y-6 text-white/70 leading-relaxed">
          <p>
            QuillFox uses Google Sign-In strictly to securely authenticate your identity.
          </p>
          <h2 className="text-2xl font-bold text-white mt-12 mb-4">What data do we request?</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Email address:</strong> Used as your unique account identifier.</li>
            <li><strong>Basic profile info:</strong> (Name and profile picture) Used to personalize your workspace and identify you to your collaborators.</li>
          </ul>
          <h2 className="text-2xl font-bold text-white mt-12 mb-4">How is it protected?</h2>
          <p>
            Your Google data is used exclusively for authentication. QuillFox never sells, shares, or monetizes this information. Your actual notes, tasks, and workspaces are end-to-end encrypted; even we cannot read them.
          </p>
          <h2 className="text-2xl font-bold text-white mt-12 mb-4">Data Deletion</h2>
          <p>
            You can delete your account and all associated data at any time from your account settings, or by emailing security@quillfox.cc.
          </p>
        </div>
      </main>
    </div>
  );
}