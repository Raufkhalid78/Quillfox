import React from 'react';
import { Shield, Lock, Key, Server, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SecurityWhitepaper() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tighter">QuillFox</span>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white/70 hover:text-white">Back to Dashboard</Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-20">
          <Shield className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <h1 className="text-5xl font-black tracking-tight mb-6">Security Whitepaper</h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            A detailed overview of how QuillFox protects your most sensitive thoughts and tasks using true Zero-Knowledge Architecture.
          </p>
        </div>

        <section className="space-y-12">
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Key className="w-8 h-8 text-emerald-500" />
              1. Local Key Generation
            </h2>
            <p className="text-white/70 text-lg leading-relaxed mb-6">
              When you create an account, QuillFox uses <code>crypto.subtle.generateKey</code> to create a robust AES-256-GCM symmetric master key directly on your device. This key is never transmitted to our servers in plaintext.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-sm text-emerald-400 font-mono">
              await window.crypto.subtle.generateKey(<br/>
              &nbsp;&nbsp;&#123; name: "AES-GCM", length: 256 &#125;,<br/>
              &nbsp;&nbsp;true,<br/>
              &nbsp;&nbsp;["encrypt", "decrypt"]<br/>
              );
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Server className="w-8 h-8 text-violet-500" />
              2. Zero-Knowledge Server
            </h2>
            <p className="text-white/70 text-lg leading-relaxed mb-6">
              Our Supabase backend only stores the encrypted ciphertext of your notes and tasks, along with the Initialization Vector (IV). The master key itself is encrypted using your user password via PBKDF2 key derivation before being synced.
            </p>
            <div className="flex flex-col md:flex-row items-center gap-4 justify-center bg-white/5 border border-white/10 rounded-xl p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                  <Lock className="w-8 h-8 text-emerald-400" />
                </div>
                <span className="text-sm font-bold">Your Device</span><br/>
                <span className="text-xs text-white/50">Master Key resides here</span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/50 to-red-500/50 my-4 md:my-0 mx-4 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase font-bold tracking-widest text-white/40 bg-[#0a0a0a] px-2">
                  Encrypted Payload
                </div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3 border border-red-500/30">
                  <Server className="w-8 h-8 text-red-400" />
                </div>
                <span className="text-sm font-bold">QuillFox Servers</span><br/>
                <span className="text-xs text-white/50">Cannot read payload</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              3. Secure Collaboration (Workspaces)
            </h2>
            <p className="text-white/70 text-lg leading-relaxed">
              When you invite someone to a workspace, QuillFox encrypts the workspace's symmetric key using the invitee's public key (RSA-OAEP). The invitee then decrypts it locally with their private key, ensuring seamless E2EE collaboration without compromising the zero-knowledge guarantee.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
