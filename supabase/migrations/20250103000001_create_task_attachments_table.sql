-- Create task_attachments table
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON public.task_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON public.task_attachments(created_at);

-- Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view attachments for their tasks" ON public.task_attachments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM public.tasks 
      WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments for their tasks" ON public.task_attachments
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM public.tasks 
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update attachments they uploaded" ON public.task_attachments
  FOR UPDATE USING (
    uploaded_by = auth.uid()
  );

CREATE POLICY "Users can delete attachments they uploaded" ON public.task_attachments
  FOR DELETE USING (
    uploaded_by = auth.uid()
  );

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload attachments for their tasks" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'task-attachments' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view attachments for their tasks" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'task-attachments' AND
    (
      -- Check if user has access to the task
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.tasks 
        WHERE assigned_to = auth.uid() OR created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete attachments they uploaded" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'task-attachments' AND
    auth.uid() IS NOT NULL
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_task_attachments_updated_at
  BEFORE UPDATE ON public.task_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_task_attachments_updated_at();
