const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_my_sessions');
  console.log("get_my_sessions:", error ? error.message : "Success", data);
  const { data: d2, error: e2 } = await supabase.rpc('get_user_sessions');
  console.log("get_user_sessions:", e2 ? e2.message : "Success", d2);
}
test();
