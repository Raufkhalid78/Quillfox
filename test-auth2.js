const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'auth' }
});

async function test() {
  const { data, error } = await supabase.from('sessions').select('*').limit(1);
  console.log("auth.sessions via db.schema:", error ? error.message : "Success", data);
}
test();
