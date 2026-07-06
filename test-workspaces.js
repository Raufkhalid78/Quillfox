require('dotenv').config({ path: '.env.local' });
// Fallback if .env is missing
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require('dotenv').config({ path: '.env' });
}
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testFetchWorkspaces() {
  // Use anon key, but we need to see what's wrong.
  // Wait, if RLS is on, anon key can't read it.
  // Let me login as the user.
  
  const email = "test@example.com"; // I don't know the user's email.
  
  // Let's just fetch profiles to get the user ID, maybe there is only 1 profile?
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  console.log("Profiles:", profiles, pErr);

}

testFetchWorkspaces();
