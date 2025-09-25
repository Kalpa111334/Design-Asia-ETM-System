-- Add Expected and Pending statuses to tasks table
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('Expected', 'Not Started', 'In Progress', 'Paused', 'Completed', 'Pending'));

-- Add a column to track when a task was forwarded from Expected to Pending
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS forwarded_at timestamp with time zone;

-- Add a column to track the original due date before forwarding
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS original_due_date timestamp with time zone;

-- Create a function to auto-forward Expected tasks to Pending
CREATE OR REPLACE FUNCTION auto_forward_expected_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update tasks that are Expected and past their due date
  UPDATE public.tasks 
  SET 
    status = 'Pending',
    forwarded_at = now(),
    original_due_date = due_date,
    due_date = (due_date + interval '1 day')::date + time '00:00:00',
    updated_at = now()
  WHERE 
    status = 'Expected' 
    AND due_date < now()::date;
    
  -- Log the forwarding action
  INSERT INTO public.time_logs (task_id, user_id, start_time, action, timestamp)
  SELECT 
    id,
    assigned_to,
    now(),
    'auto_forwarded_to_pending',
    now()
  FROM public.tasks 
  WHERE 
    status = 'Pending' 
    AND forwarded_at = now()::date
    AND original_due_date IS NOT NULL;
END;
$$;

-- Create a scheduled job to run the auto-forwarding function daily at midnight
-- Note: This would typically be set up using pg_cron or a similar extension
-- For now, we'll create a manual trigger that can be called

-- Create an index for better performance on the auto-forwarding query
CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date 
ON public.tasks (status, due_date) 
WHERE status = 'Expected';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_forward_expected_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_forward_expected_tasks() TO service_role;
