-- Add manual progress percentage to tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE public.tasks 
      ADD COLUMN progress_percentage INTEGER CHECK (progress_percentage BETWEEN 0 AND 100);
  END IF;
END $$;


