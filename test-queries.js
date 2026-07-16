const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
try {
  const envPath = path.join('d:\\Mobile Applications\\quillfox', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
} catch (e) {
  console.warn("Could not read .env file:", e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("1. Fetching all workspace memberships...");
  const { data: members, error: memErr } = await supabase
    .from('workspace_members')
    .select('*, profiles(id, email)');
  if (memErr) console.error("Error fetching memberships:", memErr);
  else console.log("Memberships:", JSON.stringify(members, null, 2));

  console.log("\n2. Fetching all workspaces...");
  const { data: workspaces, error: wsErr } = await supabase
    .from('workspaces')
    .select('*');
  if (wsErr) console.error("Error fetching workspaces:", wsErr);
  else console.log("Workspaces:", JSON.stringify(workspaces, null, 2));

  console.log("\n3. Fetching all notes...");
  const { data: notes, error: notesErr } = await supabase
    .from('notes')
    .select('*');
  if (notesErr) console.error("Error fetching notes:", notesErr);
  else console.log("Notes:", JSON.stringify(notes, null, 2));

  console.log("\n4. Fetching all todo lists...");
  const { data: todos, error: todosErr } = await supabase
    .from('todo_lists')
    .select('*, todo_items(*)');
  if (todosErr) console.error("Error fetching todo lists:", todosErr);
  else console.log("Todo Lists:", JSON.stringify(todos, null, 2));
}

test();
