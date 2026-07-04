-- 1. Add extra_collaborators column to public.profiles
alter table public.profiles 
add column if not exists extra_collaborators integer default 0;

-- 2. Update workspace member limit function
create or replace function public.check_workspace_member_limits()
returns trigger as $$
declare
  owner_tier text;
  extra_collabs integer;
  max_collabs integer;
  member_count integer;
  ws_owner_id uuid;
begin
  select owner_id into ws_owner_id from public.workspaces where id = new.workspace_id;
  select tier, coalesce(extra_collaborators, 0) into owner_tier, extra_collabs from public.profiles where id = ws_owner_id;
  
  -- Determine base limits based on tier
  if owner_tier = 'free' then
    max_collabs := 2;
  elsif owner_tier = 'premium' then
    max_collabs := 15;
  elsif owner_tier = 'ultra' then
    max_collabs := 35;
  else
    max_collabs := 2;
  end if;

  -- Add purchased extra collaborators
  max_collabs := max_collabs + extra_collabs;

  -- Enforce limit
  select count(*) into member_count from public.workspace_members where workspace_id = new.workspace_id;
  if member_count >= max_collabs then
    raise exception 'Workspace collaborator limit reached (%). Please upgrade your plan or purchase an add-on.', max_collabs;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 3. Device/Session Limit Enforcement Trigger on auth.sessions
create or replace function public.enforce_device_limits()
returns trigger as $$
declare
  user_tier text;
  max_devices integer;
  current_sessions integer;
begin
  -- Get user tier
  select tier into user_tier from public.profiles where id = new.user_id;
  
  if user_tier = 'free' then
    max_devices := 1;
  elsif user_tier = 'premium' then
    max_devices := 3;
  elsif user_tier = 'ultra' then
    max_devices := 5;
  else
    max_devices := 1;
  end if;

  -- Check current session count for this user
  select count(*) into current_sessions from auth.sessions where user_id = new.user_id;

  -- If exceeding limit, delete the oldest sessions to enforce the maximum
  if current_sessions > max_devices then
    delete from auth.sessions 
    where id in (
      select id from auth.sessions 
      where user_id = new.user_id 
      order by created_at asc 
      limit (current_sessions - max_devices)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_device_limits_trigger on auth.sessions;
create trigger enforce_device_limits_trigger
  after insert on auth.sessions
  for each row execute procedure public.enforce_device_limits();
