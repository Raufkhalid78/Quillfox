import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET() {
  const { data: profiles, error: pErr } = await supabaseAdmin.from('profiles').select('*');
  const { data: workspaces, error: wErr } = await supabaseAdmin.from('workspaces').select('*');
  return NextResponse.json({ profiles, pErr, workspaces, wErr });
}
