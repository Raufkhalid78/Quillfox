-- QuillFox Schema Update Script
-- Run this in your Supabase SQL Editor to safely apply the updated RLS policies and RPCs without wiping your existing tables or data.

-- 1. Safely drop and recreate profile policies
drop policy if exists "Allow users to read their own profile" on public.profiles;
drop policy if exists "Allow users to read profiles of workspace members" on public.profiles;
drop policy if exists "Allow users to update their own profile" on public.profiles;

create policy "Allow users to read their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Allow users to read profiles of workspace members" on public.profiles for select using (
  exists (
    select 1 from public.workspace_members wm1 
    join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id 
    where wm1.user_id = auth.uid() and wm2.user_id = profiles.id
  )
);
create policy "Allow users to update their own profile" on public.profiles for update using (auth.uid() = id);

-- 2. Secure RPC for searching users by email without exposing sensitive data
create or replace function public.get_profile_by_email(search_email text)
returns table (id uuid, name text, email text, image text)
security definer
as $$
begin
  return query select p.id, p.name, p.email, p.image from public.profiles p where p.email = search_email limit 1;
end;
$$ language plpgsql;

-- 3. Safely drop and recreate workspace_members policies
drop policy if exists "Allow members to read memberships" on public.workspace_members;
drop policy if exists "Allow owners to insert memberships" on public.workspace_members;
drop policy if exists "Allow owners to update memberships" on public.workspace_members;
drop policy if exists "Allow owners to delete memberships" on public.workspace_members;

create policy "Allow members to read memberships" on public.workspace_members for select using (
  auth.uid() = user_id or
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid()
  )
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

-- 4. Safely drop and recreate todo_items policies
drop policy if exists "Allow all access to own/workspace todo items" on public.todo_items;

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

-- 5. Add encrypted_master_key to profiles if it doesn't exist
alter table public.profiles add column if not exists encrypted_master_key text;

-- 6. Add Free Tier Enforcement Triggers
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
