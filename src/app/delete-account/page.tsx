"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/stores/app-store';

export default function DeleteAccountScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Check session on load
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.user) {
        setCurrentUser(data.user);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    
    const confirmed = window.confirm("Are you absolutely sure you want to permanently delete your account and all associated data? This cannot be undone.");
    if (!confirmed) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Failed to delete account.");
      }

      await supabase.auth.signOut();
      useAppStore.getState().logout();
      setSuccess(true);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="flex flex-col items-center max-w-md w-full">
          <ShieldAlert size={64} className="text-emerald-500" />
          <h1 className="text-white text-2xl font-bold mt-4 mb-2 text-center">Account Deleted</h1>
          <p className="text-gray-400 text-center mb-6">
            Your account and all associated data have been permanently deleted from our servers. A confirmation email has been sent.
          </p>
          <Link 
            href="/"
            className="bg-neutral-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-neutral-700 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 pt-12 flex flex-col items-center font-sans">
      <div className="w-full max-w-md">
        <Link 
          href="/"
          className="flex items-center text-zinc-400 hover:text-white mb-8 transition-colors w-fit"
        >
          <ArrowLeft size={24} />
          <span className="ml-2 font-medium">Back</span>
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <Trash2 size={32} className="text-red-500" />
          </div>
          <h1 className="text-white text-3xl font-bold mb-2">Delete Account</h1>
          <p className="text-zinc-400 text-center">
            This action is permanent and will delete all your notes, tasks, workspaces, and profile data immediately.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 p-4 rounded-xl mb-6 border border-red-500/30">
            <p className="text-red-400 text-center">{errorMsg}</p>
          </div>
        )}

        {!currentUser ? (
          <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-4 text-center">
              Please log in to verify your identity before deleting your account.
            </p>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="email"
                className="bg-black text-white px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-neutral-600 transition-colors"
                placeholder="Email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                className="bg-black text-white px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-neutral-600 transition-colors"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="submit"
                disabled={loading}
                className="bg-white text-black p-4 rounded-xl font-bold mt-2 hover:bg-neutral-200 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Sign In to Continue'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-neutral-900 p-6 rounded-2xl border border-red-500/30">
            <p className="text-white font-medium text-center mb-6">
              You are currently logged in as <span className="font-bold text-red-400">{currentUser.email}</span>.
            </p>
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="w-full bg-red-500 text-white p-4 rounded-xl font-bold flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin text-white" />
              ) : (
                <>
                  <Trash2 size={20} className="mr-2" />
                  <span>Permanently Delete My Data</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
