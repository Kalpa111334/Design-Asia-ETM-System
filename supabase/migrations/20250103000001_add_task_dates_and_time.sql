-- Add new date and time fields to tasks table
ALTER TABLE public.tasks
ADD COLUMN start_date timestamp with time zone NOT NULL DEFAULT NOW(),
ADD COLUMN end_date timestamp with time zone NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
ADD COLUMN time_assigning integer NOT NULL DEFAULT 60; -- in minutes

-- Update existing tasks with default values
UPDATE public.tasks 
SET 
  start_date = created_at,
  end_date = due_date,
  time_assigning = 60
WHERE start_date IS NULL OR end_date IS NULL OR time_assigning IS NULL;

-- Create function to automatically update task status based on dates
CREATE OR REPLACE FUNCTION public.update_task_status_by_dates()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    task_record RECORD;
    current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    FOR task_record IN
        SELECT id, start_date, end_date, status
        FROM public.tasks
        WHERE status IN ('Expected', 'Not Started', 'In Progress', 'Paused')
    LOOP
        -- If current time is before start_date, set to Expected
        IF current_time < task_record.start_date THEN
            UPDATE public.tasks
            SET status = 'Expected'
            WHERE id = task_record.id AND status != 'Expected';
        -- If current time is between start_date and end_date, set to Not Started (if not already started)
        ELSIF current_time >= task_record.start_date AND current_time <= task_record.end_date THEN
            IF task_record.status = 'Expected' THEN
                UPDATE public.tasks
                SET status = 'Not Started'
                WHERE id = task_record.id;
            END IF;
        -- If current time is after end_date and task is not completed, set to Pending
        ELSIF current_time > task_record.end_date AND task_record.status NOT IN ('Completed', 'Pending') THEN
            UPDATE public.tasks
            SET 
                status = 'Pending',
                forwarded_at = current_time,
                original_due_date = due_date,
                due_date = (current_time + INTERVAL '1 day')
            WHERE id = task_record.id;
        END IF;
    END LOOP;
END;
$$;

-- Create a scheduled job to run the status update function every minute
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('update-task-status', '* * * * *', 'SELECT public.update_task_status_by_dates();');
