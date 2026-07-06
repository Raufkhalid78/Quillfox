require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testJoinQuery() {
  console.log("Testing join query...");

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(*, workspace_members(user_id), notes(id, is_archived), todo_lists(id, is_archived))')
    .limit(1);

  if (error) {
    console.error("Query failed! Error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Query succeeded! Data:", data);
  }
}

testJoinQuery();
