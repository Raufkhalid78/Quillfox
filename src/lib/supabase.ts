import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your-supabase-project-url'
  ? process.env.NEXT_PUBLIC_SUPABASE_URL
  : 'https://placeholder.supabase.co'

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your-supabase-anon-key'
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
