-- Update tasks_status_check constraint to replace 'Expected' with 'Planned'
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('Planned', 'Not Started', 'In Progress', 'Paused', 'Completed', 'Pending'));
