import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

// Need service role key to get users
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr || !users.length) {
    console.log("Auth err or no users:", authErr)
    return
  }
  const user = users[0]

  console.log("Testing notes query for user:", user.id)
  
  // Need to act as the user for RLS to apply
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } }
  })
  
  // We don't have user JWT easily without login. Let's just do a direct login with a test user?
  // Wait, I can't easily fake the auth.uid() in Supabase JS without the JWT.
  // Instead, let's just make a POST request to Supabase REST API directly or check the database logs?
  // Wait! I can see infinite recursion in the Postgres log or just fix it.
}

test()
