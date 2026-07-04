-- 1. Create a helper function that securely checks membership without triggering infinite recursion
create or replace function public.is_workspace_member(ws_id text)
returns boolean
security definer
as $$
begin
  return exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
end;
$$ language plpgsql;

-- 2. Update workspaces SELECT policy
drop policy if exists "Allow members to read workspaces" on public.workspaces;
create policy "Allow members to read workspaces" on public.workspaces for select using (
  auth.uid() = owner_id or 
  public.is_workspace_member(id)
);

-- 3. Update workspace_members SELECT policy
drop policy if exists "Allow members to read memberships" on public.workspace_members;
create policy "Allow members to read memberships" on public.workspace_members for select using (
  auth.uid() = user_id or
  public.is_workspace_member(workspace_id)
);

-- 4. Update profiles SELECT policy
drop policy if exists "Allow users to read profiles of workspace members" on public.profiles;
create policy "Allow users to read profiles of workspace members" on public.profiles for select using (
  exists (
    select 1 from public.workspace_members
    where user_id = profiles.id and public.is_workspace_member(workspace_id)
  )
);

-- 5. Update notes SELECT policy
drop policy if exists "Allow access to own or workspace notes" on public.notes;
create policy "Allow access to own or workspace notes" on public.notes for select using (
  auth.uid() = author_id or (
    workspace_id is not null and public.is_workspace_member(workspace_id)
  )
);

-- 6. Update todo_lists SELECT policy
drop policy if exists "Allow access to own/workspace todo_lists" on public.todo_lists;
create policy "Allow access to own/workspace todo_lists" on public.todo_lists for select using (
  auth.uid() = author_id or (
    workspace_id is not null and public.is_workspace_member(workspace_id)
  )
);

-- 7. Update todo_items policies
drop policy if exists "Allow all access to own/workspace todo items" on public.todo_items;
create policy "Allow all access to own/workspace todo items" on public.todo_items for all using (
  exists (
    select 1 from public.todo_lists 
    where todo_lists.id = todo_items.todo_list_id and (
      todo_lists.author_id = auth.uid() or (
        todo_lists.workspace_id is not null and public.is_workspace_member(todo_lists.workspace_id)
      )
    )
  )
) with check (
  exists (
    select 1 from public.todo_lists 
    where todo_lists.id = todo_items.todo_list_id and (
      todo_lists.author_id = auth.uid() or (
        todo_lists.workspace_id is not null and public.is_workspace_member(todo_lists.workspace_id)
      )
    )
  )
);
