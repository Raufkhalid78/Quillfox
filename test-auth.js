const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('sessions').select('*').limit(1);
  console.log("public.sessions:", error ? error.message : "Success");
  
  const { data: d2, error: e2 } = await supabase.schema('auth').from('sessions').select('*').limit(1);
  console.log("auth.sessions:", e2 ? e2.message : "Success");
}
test();
