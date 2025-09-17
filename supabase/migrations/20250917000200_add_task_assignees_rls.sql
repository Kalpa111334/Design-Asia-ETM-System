-- RLS: Allow employees to view tasks assigned via task_assignees
do $$ begin
  begin
    create policy "Employees can view tasks via task_assignees"
      on public.tasks for select
      using (
        exists (
          select 1 from public.task_assignees ta
          where ta.task_id = tasks.id and ta.user_id = auth.uid()
        )
        or exists (
          select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
      );
  exception when others then null; end;
end $$;

-- RLS: Allow users to create proofs if they are in task_assignees for that task
do $$ begin
  begin
    create policy "Users can create proofs for task_assignees tasks"
      on public.task_proofs for insert
      with check (
        exists (
          select 1 from public.task_assignees ta
          where ta.task_id = task_id and ta.user_id = auth.uid()
        )
      );
  exception when others then null; end;
end $$;

-- RLS: Allow employees to view task_locations for tasks assigned via task_assignees
do $$ begin
  begin
    create policy "Employees can view locations via task_assignees"
      on public.task_locations for select
      using (
        exists (
          select 1 from public.task_assignees ta
          where ta.task_id = task_locations.task_id and ta.user_id = auth.uid()
        )
        or exists (
          select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
      );
  exception when others then null; end;
end $$;

