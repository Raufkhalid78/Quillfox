-- =========================================================
-- PHASE 1: TABLE DEFINITIONS (Dependencies first)
-- =========================================================

-- 1. Profiles Table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name text,
  email text NOT NULL,
  image text,
  tier text DEFAULT 'free' NOT NULL,
  vault_auto_lock boolean DEFAULT false NOT NULL,
  vault_lock_timeout integer DEFAULT 15 NOT NULL,
  vault_passcode_hash text,
  public_rsa_key text,
  encrypted_private_rsa_key text,
  push_token text,
  trial_ends_at timestamp with time zone,
  extra_collaborators integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  color text DEFAULT '#059669' NOT NULL,
  icon text,
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Workspace Members Table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  workspace_id text REFERENCES public.workspaces ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  encrypted_workspace_key text,
  is_muted boolean DEFAULT false NOT NULL,
  UNIQUE (user_id, workspace_id)
);

-- 4. Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text DEFAULT '' NOT NULL,
  workspace_id text REFERENCES public.workspaces ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  is_pinned boolean DEFAULT false NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Todo Lists Table
CREATE TABLE IF NOT EXISTS public.todo_lists (
  id text PRIMARY KEY,
  title text NOT NULL,
  workspace_id text REFERENCES public.workspaces ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  is_pinned boolean DEFAULT false NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Todo Items Table
CREATE TABLE IF NOT EXISTS public.todo_items (
  id text PRIMARY KEY,
  title text NOT NULL,
  completed boolean DEFAULT false NOT NULL,
  completed_at timestamp with time zone,
  "order" integer DEFAULT 0 NOT NULL,
  todo_list_id text REFERENCES public.todo_lists ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Note Versions Table
CREATE TABLE IF NOT EXISTS public.note_versions (
  id text PRIMARY KEY,
  note_id text REFERENCES public.notes ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  version integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Folders Table
CREATE TABLE IF NOT EXISTS public.folders (
  id text PRIMARY KEY,
  name text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================
-- PHASE 2: SECURITY FUNCTIONS (Bypasses RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id text, u_id uuid)
RETURNS boolean
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = ws_id AND user_id = u_id
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- PHASE 3: ENABLE SECURITY (RLS)
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PHASE 4: ROW LEVEL SECURITY POLICIES
-- =========================================================

-- Profiles Policies

DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to read profiles of workspace members" ON public.profiles;
CREATE POLICY "Allow users to read profiles of workspace members" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm1 
    JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id 
    WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
  )
);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Workspaces Policies

DROP POLICY IF EXISTS "Allow members to read workspaces" ON public.workspaces;
CREATE POLICY "Allow members to read workspaces" ON public.workspaces FOR SELECT USING (
  auth.uid() = owner_id OR 
  EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_members.workspace_id = workspaces.id AND workspace_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow owners to insert workspaces" ON public.workspaces;
CREATE POLICY "Allow owners to insert workspaces" ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow owners to update workspaces" ON public.workspaces;
CREATE POLICY "Allow owners to update workspaces" ON public.workspaces FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow owners to delete workspaces" ON public.workspaces;
CREATE POLICY "Allow owners to delete workspaces" ON public.workspaces FOR DELETE USING (auth.uid() = owner_id);

-- Workspace Members Policies (Uses helper function to avoid infinite recursion)

DROP POLICY IF EXISTS "Allow select workspace_members" ON public.workspace_members;
CREATE POLICY "Allow select workspace_members" ON public.workspace_members FOR SELECT USING (
  auth.uid() = user_id OR public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Allow insert workspace_members" ON public.workspace_members;
CREATE POLICY "Allow insert workspace_members" ON public.workspace_members FOR INSERT WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE workspaces.id = workspace_members.workspace_id AND workspaces.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow update workspace_members" ON public.workspace_members;
CREATE POLICY "Allow update workspace_members" ON public.workspace_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE workspaces.id = workspace_members.workspace_id AND workspaces.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow delete workspace_members" ON public.workspace_members;
CREATE POLICY "Allow delete workspace_members" ON public.workspace_members FOR DELETE USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE workspaces.id = workspace_members.workspace_id AND workspaces.owner_id = auth.uid()
  )
);

-- Notes Policies

DROP POLICY IF EXISTS "Allow select notes" ON public.notes;
CREATE POLICY "Allow select notes" ON public.notes FOR SELECT USING (
  auth.uid() = author_id OR (
    workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Allow insert notes" ON public.notes;
CREATE POLICY "Allow insert notes" ON public.notes FOR INSERT WITH CHECK (
  auth.uid() = author_id AND (
    workspace_id IS NULL OR EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Allow update notes" ON public.notes;
CREATE POLICY "Allow update notes" ON public.notes FOR UPDATE USING (
  auth.uid() = author_id OR (
    workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Allow delete notes" ON public.notes;
CREATE POLICY "Allow delete notes" ON public.notes FOR DELETE USING (
  auth.uid() = author_id OR (
    workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

-- Todo Lists Policies

DROP POLICY IF EXISTS "Allow select todo_lists" ON public.todo_lists;
CREATE POLICY "Allow select todo_lists" ON public.todo_lists FOR SELECT USING (
  auth.uid() = author_id OR (
    workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = todo_lists.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Allow insert todo_lists" ON public.todo_lists;
CREATE POLICY "Allow insert todo_lists" ON public.todo_lists FOR INSERT WITH CHECK (
  auth.uid() = author_id AND (
    workspace_id IS NULL OR EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = todo_lists.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Allow update todo_lists" ON public.todo_lists;
CREATE POLICY "Allow update todo_lists" ON public.todo_lists FOR UPDATE USING (
  auth.uid() = author_id OR (
    workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = todo_lists.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Allow delete todo_lists" ON public.todo_lists;
CREATE POLICY "Allow delete todo_lists" ON public.todo_lists FOR DELETE USING (
  auth.uid() = author_id OR (
    workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_members.workspace_id = todo_lists.workspace_id AND workspace_members.user_id = auth.uid()
    )
  )
);

-- Todo Items Policies

DROP POLICY IF EXISTS "Allow all access to todo items" ON public.todo_items;
CREATE POLICY "Allow all access to todo items" ON public.todo_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.todo_lists 
    WHERE todo_lists.id = todo_items.todo_list_id AND (
      todo_lists.author_id = auth.uid() OR (
        todo_lists.workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members 
          WHERE workspace_members.workspace_id = todo_lists.workspace_id AND workspace_members.user_id = auth.uid()
        )
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.todo_lists 
    WHERE todo_lists.id = todo_items.todo_list_id AND (
      todo_lists.author_id = auth.uid() OR (
        todo_lists.workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members 
          WHERE workspace_members.workspace_id = todo_lists.workspace_id AND workspace_members.user_id = auth.uid()
        )
      )
    )
  )
);

-- Note Versions Policies

DROP POLICY IF EXISTS "Allow select note versions" ON public.note_versions;
CREATE POLICY "Allow select note versions" ON public.note_versions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.notes 
    WHERE notes.id = note_versions.note_id AND (notes.author_id = auth.uid() OR (
      notes.workspace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members 
        WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
      )
    ))
  )
);

DROP POLICY IF EXISTS "Allow modify note versions" ON public.note_versions;
CREATE POLICY "Allow modify note versions" ON public.note_versions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.notes 
    WHERE notes.id = note_versions.note_id AND notes.author_id = auth.uid()
  )
);

-- Activity Logs Policies

DROP POLICY IF EXISTS "Allow select access to own activity_logs" ON public.activity_logs;
CREATE POLICY "Allow select access to own activity_logs" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow insert access to own activity_logs" ON public.activity_logs;
CREATE POLICY "Allow insert access to own activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Folders Policies

DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders" ON public.folders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;
CREATE POLICY "Users can insert their own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
CREATE POLICY "Users can update their own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
CREATE POLICY "Users can delete their own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- =========================================================
-- PHASE 5: DB FUNCTIONS & TRIGGERS
-- =========================================================

-- Secure RPC for searching collaborators by email
CREATE OR REPLACE FUNCTION public.get_profile_by_email(search_email text)
RETURNS TABLE (id uuid, name text, email text, image text, public_rsa_key text)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.name, p.email, p.image, p.public_rsa_key FROM public.profiles p WHERE p.email = search_email LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Creates public profile row on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    name,
    public_rsa_key,
    encrypted_private_rsa_key
  )
  VALUES (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'public_rsa_key',
    new.raw_user_meta_data->>'encrypted_private_rsa_key'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger function: Note limit check
CREATE OR REPLACE FUNCTION public.check_note_limits()
RETURNS trigger AS $$
DECLARE
  user_tier text;
  note_count integer;
  author_uuid uuid;
BEGIN
  author_uuid := new.author_id::uuid;
  
  SELECT tier INTO user_tier FROM public.profiles WHERE id = author_uuid;
  IF user_tier = 'free' THEN
    SELECT count(*) INTO note_count FROM public.notes WHERE author_id = author_uuid;
    IF note_count >= 10 THEN
      RAISE EXCEPTION 'Free tier limit reached: Maximum 10 notes allowed.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_note_limits ON public.notes;
CREATE TRIGGER enforce_note_limits
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE PROCEDURE public.check_note_limits();

-- Trigger function: Todo List limit check
CREATE OR REPLACE FUNCTION public.check_todo_list_limits()
RETURNS trigger AS $$
DECLARE
  user_tier text;
  todo_count integer;
  author_uuid uuid;
BEGIN
  author_uuid := new.author_id::uuid;

  SELECT tier INTO user_tier FROM public.profiles WHERE id = author_uuid;
  IF user_tier = 'free' THEN
    SELECT count(*) INTO todo_count FROM public.todo_lists WHERE author_id = author_uuid;
    IF todo_count >= 3 THEN
      RAISE EXCEPTION 'Free tier limit reached: Maximum 3 todo lists allowed.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_todo_list_limits ON public.todo_lists;
CREATE TRIGGER enforce_todo_list_limits
  BEFORE INSERT ON public.todo_lists
  FOR EACH ROW EXECUTE PROCEDURE public.check_todo_list_limits();

-- Trigger function: Workspace member limit check
CREATE OR REPLACE FUNCTION public.check_workspace_member_limits()
RETURNS trigger AS $$
DECLARE
  owner_tier text;
  member_count integer;
  ws_owner_id uuid;
BEGIN
  SELECT owner_id INTO ws_owner_id FROM public.workspaces WHERE id = new.workspace_id;
  SELECT tier INTO owner_tier FROM public.profiles WHERE id = ws_owner_id;
  
  IF owner_tier = 'free' THEN
    SELECT count(*) INTO member_count FROM public.workspace_members WHERE workspace_id = new.workspace_id;
    IF member_count >= 2 THEN
      RAISE EXCEPTION 'Free tier limit reached: Maximum 2 collaborators allowed.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_workspace_member_limits ON public.workspace_members;
CREATE TRIGGER enforce_workspace_member_limits
  BEFORE INSERT ON public.workspace_members
  FOR EACH ROW EXECUTE PROCEDURE public.check_workspace_member_limits();

-- =========================================================
-- PHASE 6: STORAGE BUCKETS SETUP
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Bucket Policies

DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
CREATE POLICY "Allow public read access to avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow authenticated upload to avatars" ON storage.objects;
CREATE POLICY "Allow authenticated upload to avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow users to update own avatar" ON storage.objects;
CREATE POLICY "Allow users to update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Allow users to delete own avatar" ON storage.objects;
CREATE POLICY "Allow users to delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add folder_id, due_date, and reminder_id to notes and todo_lists
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id text REFERENCES public.folders(id) ON DELETE SET NULL;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS reminder_id text;

ALTER TABLE public.todo_lists ADD COLUMN IF NOT EXISTS folder_id text REFERENCES public.folders(id) ON DELETE SET NULL;
ALTER TABLE public.todo_lists ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;
ALTER TABLE public.todo_lists ADD COLUMN IF NOT EXISTS reminder_id text;

-- Drop unused encryption keys from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS encrypted_master_key;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS encryption_salt;

