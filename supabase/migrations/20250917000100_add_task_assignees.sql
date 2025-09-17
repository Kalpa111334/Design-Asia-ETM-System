-- Create task_assignees join table for multi-employee tasks
create table if not exists public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.users(id) on delete set null,
  primary key (task_id, user_id)
);

alter table public.task_assignees enable row level security;

-- Policies
drop policy if exists "Admins can manage task assignees" on public.task_assignees;
drop policy if exists "Users can view their task assignees" on public.task_assignees;

create policy "Admins can manage task assignees"
  on public.task_assignees for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "Users can view their task assignees"
  on public.task_assignees for select
  using (
    user_id = auth.uid() or exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Optional helper view to fetch tasks visible to a user via join
create or replace view public.v_user_tasks as
  select t.*
  from public.tasks t
  where t.assigned_to = auth.uid()
  union
  select t.*
  from public.tasks t
  join public.task_assignees ta on ta.task_id = t.id
  where ta.user_id = auth.uid();

