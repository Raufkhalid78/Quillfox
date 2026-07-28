-- 1. Create Profiles Table (links auth.users with public profile info)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text not null,
  image text,
  tier text default 'free' not null,
  vault_auto_lock boolean default false not null,
  vault_lock_timeout integer default 15 not null,
  vault_passcode_hash text,
  encrypted_master_key text,
  public_rsa_key text,
  encrypted_private_rsa_key text,
  trial_ends_at timestamp with time zone,
  extra_collaborators integer default 0 not null,
  encryption_salt text,
  push_token text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;
create policy "Allow users to read their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Allow users to read profiles of workspace members" on public.profiles for select using (
  exists (
    select 1 from public.workspace_members wm1 
    join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id 
    where wm1.user_id = auth.uid() and wm2.user_id = profiles.id
  )
);
create policy "Allow users to update their own profile" on public.profiles for update using (auth.uid() = id);

-- Secure RPC for searching users by email without exposing sensitive data
create or replace function public.get_profile_by_email(search_email text)
returns table (id uuid, name text, email text, image text, public_rsa_key text)
security definer
as $$
begin
  return query select p.id, p.name, p.email, p.image, p.public_rsa_key from public.profiles p where p.email = search_email limit 1;
end;
$$ language plpgsql;

-- Trigger to automatically insert a profile when a user registers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, 
    email, 
    name,
    encrypted_master_key,
    public_rsa_key,
    encrypted_private_rsa_key
  )
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'encrypted_master_key',
    new.raw_user_meta_data->>'public_rsa_key',
    new.raw_user_meta_data->>'encrypted_private_rsa_key'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Create Workspaces Table
create table if not exists public.workspaces (
  id text primary key,
  title text not null,
  description text,
  color text default '#059669' not null,
  icon text,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workspaces enable row level security;

-- 3. Create Workspace Members Table
create table if not exists public.workspace_members (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  workspace_id text references public.workspaces on delete cascade not null,
  role text default 'member' not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  encrypted_workspace_key text,
  is_muted boolean default false not null,
  unique (user_id, workspace_id)
);

alter table public.workspace_members enable row level security;

-- Helper function: avoids RLS infinite recursion on workspace_members SELECT policy.
-- Called from policies on other tables too (notes, todo_lists etc.) to check membership.
create or replace function public.is_workspace_member(ws_id text, u_id uuid)
returns boolean
security definer
as $$
begin
  return exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = u_id
  );
end;
$$ language plpgsql;

-- Workspaces RLS Policies
create policy "Allow members to read workspaces" on public.workspaces for select using (
  auth.uid() = owner_id or 
  exists (
    select 1 from public.workspace_members 
    where workspace_members.workspace_id = workspaces.id and workspace_members.user_id = auth.uid()
  )
);
create policy "Allow owners to insert workspaces" on public.workspaces for insert with check (auth.uid() = owner_id);
create policy "Allow owners to update workspaces" on public.workspaces for update using (auth.uid() = owner_id);
create policy "Allow owners to delete workspaces" on public.workspaces for delete using (auth.uid() = owner_id);

-- Workspace Members RLS Policies
-- Uses is_workspace_member() helper to avoid infinite recursion (Postgres rejects
-- policies that query the same table they are protecting via a plain sub-select).
create policy "Allow members to read memberships" on public.workspace_members for select using (
  auth.uid() = user_id or
  public.is_workspace_member(workspace_id, auth.uid())
);
create policy "Allow owners to insert memberships" on public.workspace_members for insert with check (
  exists (
    select 1 from public.workspaces 
    where workspaces.id = workspace_members.workspace_id and workspaces.owner_id = auth.uid()
  )
);
create policy "Allow owners to update memberships" on public.workspace_members for update using (
  exists (
    select 1 from public.workspaces 
    where workspaces.id = workspace_members.workspace_id and workspaces.owner_id = auth.uid()
  )
);
create policy "Allow owners to delete memberships" on public.workspace_members for delete using (
  exists (
    select 1 from public.workspaces 
    where workspaces.id = workspace_members.workspace_id and workspaces.owner_id = auth.uid()
  )
);

-- 4. Create Notes Table
create table if not exists public.notes (
  id text primary key,
  title text not null,
  content text default '' not null,
  workspace_id text references public.workspaces on delete cascade,
  author_id uuid references auth.users on delete cascade not null,
  is_pinned boolean default false not null,
  is_archived boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.notes enable row level security;
create policy "Allow access to own or workspace notes" on public.notes for select using (
  auth.uid() = author_id or (
    workspace_id is not null and exists (
      select 1 from public.workspace_members 
      where workspace_members.workspace_id = notes.workspace_id and workspace_members.user_id = auth.uid()
    )
  )
);
create policy "Allow inserting own notes" on public.notes for insert with check (auth.uid() = author_id);
create policy "Allow updating own notes" on public.notes for update using (auth.uid() = author_id);
create policy "Allow deleting own notes" on public.notes for delete using (auth.uid() = author_id);

-- 5. Create Todo Lists Table
create table if not exists public.todo_lists (
  id text primary key,
  title text not null,
  workspace_id text references public.workspaces on delete cascade,
  author_id uuid references auth.users on delete cascade not null,
  is_pinned boolean default false not null,
  is_archived boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.todo_lists enable row level security;
create policy "Allow access to own/workspace todo_lists" on public.todo_lists for select using (
  auth.uid() = author_id or (
    workspace_id is not null and exists (
      select 1 from public.workspace_members 
      where workspace_members.workspace_id = todo_lists.workspace_id and workspace_members.user_id = auth.uid()
    )
  )
);
create policy "Allow inserting own todo_lists" on public.todo_lists for insert with check (auth.uid() = author_id);
create policy "Allow updating own todo_lists" on public.todo_lists for update using (auth.uid() = author_id);
create policy "Allow deleting own todo_lists" on public.todo_lists for delete using (auth.uid() = author_id);

-- 6. Create Todo Items Table
create table if not exists public.todo_items (
  id text primary key,
  title text not null,
  completed boolean default false not null,
  completed_at timestamp with time zone,
  "order" integer default 0 not null,
  todo_list_id text references public.todo_lists on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.todo_items enable row level security;
create policy "Allow all access to own/workspace todo items" on public.todo_items for all using (
  exists (
    select 1 from public.todo_lists 
    where todo_lists.id = todo_items.todo_list_id and (todo_lists.author_id = auth.uid() or (
      todo_lists.workspace_id is not null and exists (
        select 1 from public.workspace_members 
        where workspace_members.workspace_id = todo_lists.workspace_id and workspace_members.user_id = auth.uid()
      )
    ))
  )
) with check (
  exists (
    select 1 from public.todo_lists 
    where todo_lists.id = todo_items.todo_list_id and (todo_lists.author_id = auth.uid() or (
      todo_lists.workspace_id is not null and exists (
        select 1 from public.workspace_members 
        where workspace_members.workspace_id = todo_lists.workspace_id and workspace_members.user_id = auth.uid()
      )
    ))
  )
);

-- 7. Create Note Versions Table
create table if not exists public.note_versions (
  id text primary key,
  note_id text references public.notes on delete cascade not null,
  title text not null,
  content text not null,
  version integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.note_versions enable row level security;
create policy "Allow select note versions" on public.note_versions for select using (
  exists (
    select 1 from public.notes 
    where notes.id = note_versions.note_id and (notes.author_id = auth.uid() or (
      notes.workspace_id is not null and exists (
        select 1 from public.workspace_members 
        where workspace_members.workspace_id = notes.workspace_id and workspace_members.user_id = auth.uid()
      )
    ))
  )
);
create policy "Allow modify note versions" on public.note_versions for all using (
  exists (
    select 1 from public.notes 
    where notes.id = note_versions.note_id and notes.author_id = auth.uid()
  )
);

-- 8. Create Activity Logs Table
create table if not exists public.activity_logs (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  activity_type text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.activity_logs enable row level security;
create policy "Allow select access to own activity_logs" on public.activity_logs for select using (auth.uid() = user_id);
create policy "Allow insert access to own activity_logs" on public.activity_logs for insert with check (auth.uid() = user_id);

-- 9. Add Free Tier Enforcement Triggers
create or replace function public.check_note_limits()
returns trigger as $$
declare
  user_tier text;
  note_count integer;
begin
  select tier into user_tier from public.profiles where id = new.author_id;
  if user_tier = 'free' then
    select count(*) into note_count from public.notes where author_id = new.author_id;
    if note_count >= 10 then
      raise exception 'Free tier limit reached: Maximum 10 notes allowed.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_note_limits on public.notes;
create trigger enforce_note_limits
  before insert on public.notes
  for each row execute procedure public.check_note_limits();

create or replace function public.check_todo_list_limits()
returns trigger as $$
declare
  user_tier text;
  todo_count integer;
begin
  select tier into user_tier from public.profiles where id = new.author_id;
  if user_tier = 'free' then
    select count(*) into todo_count from public.todo_lists where author_id = new.author_id;
    if todo_count >= 3 then
      raise exception 'Free tier limit reached: Maximum 3 todo lists allowed.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_todo_list_limits on public.todo_lists;
create trigger enforce_todo_list_limits
  before insert on public.todo_lists
  for each row execute procedure public.check_todo_list_limits();

create or replace function public.check_workspace_member_limits()
returns trigger as $$
declare
  owner_tier text;
  member_count integer;
  ws_owner_id uuid;
begin
  select owner_id into ws_owner_id from public.workspaces where id = new.workspace_id;
  select tier into owner_tier from public.profiles where id = ws_owner_id;
  
  if owner_tier = 'free' then
    select count(*) into member_count from public.workspace_members where workspace_id = new.workspace_id;
    if member_count >= 2 then
      raise exception 'Free tier limit reached: Maximum 2 collaborators allowed.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_workspace_member_limits on public.workspace_members;
create trigger enforce_workspace_member_limits
  before insert on public.workspace_members
  for each row execute procedure public.check_workspace_member_limits();

-- Create Folders Table
create table if not exists public.folders (
  id text primary key,
  name text not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.folders enable row level security;
create policy "Users can view their own folders" on public.folders for select using (auth.uid() = user_id);
create policy "Users can insert their own folders" on public.folders for insert with check (auth.uid() = user_id);
create policy "Users can update their own folders" on public.folders for update using (auth.uid() = user_id);
create policy "Users can delete their own folders" on public.folders for delete using (auth.uid() = user_id);

-- Add folder_id, due_date, and reminder_id to notes and todo_lists
alter table public.notes add column if not exists folder_id text references public.folders(id) on delete set null;
alter table public.notes add column if not exists due_date timestamp with time zone;
alter table public.notes add column if not exists reminder_id text;

alter table public.todo_lists add column if not exists folder_id text references public.folders(id) on delete set null;
alter table public.todo_lists add column if not exists due_date timestamp with time zone;
alter table public.todo_lists add column if not exists reminder_id text;

