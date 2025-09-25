-- Fix auto_forward_expected_tasks to remove invalid insert into time_logs (no action column)
-- This replaces the previous version that attempted to log into time_logs.

create or replace function public.auto_forward_expected_tasks()
returns void
language plpgsql
security definer
as $$
begin
  -- Forward overdue Expected tasks to Pending
  update public.tasks t
  set
    status = 'Pending',
    forwarded_at = now(),
    original_due_date = coalesce(t.original_due_date, t.due_date),
    -- set new due date to tomorrow at midnight (UTC)
    due_date = (now()::date + interval '1 day')::date + time '00:00:00',
    updated_at = now()
  where
    t.status = 'Expected'
    and t.due_date::date < now()::date;
end;
$$;

grant execute on function public.auto_forward_expected_tasks() to authenticated;
grant execute on function public.auto_forward_expected_tasks() to service_role;


