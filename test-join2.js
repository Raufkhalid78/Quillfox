require('dotenv').config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testJoinQuery() {
  console.log("Testing memberOf query with nested filter...");

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(*, workspace_members(user_id), notes(id, is_archived), todo_lists(id, is_archived))')
    .eq('user_id', '00000000-0000-0000-0000-000000000000') // Fake user ID just to test syntax
    .not('workspaces.owner_id', 'eq', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error("Query failed! Error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Query succeeded!");
  }
}

testJoinQuery();
