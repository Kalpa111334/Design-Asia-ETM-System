-- Create task_attachments table for storing file attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON public.task_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON public.task_attachments(created_at);

-- Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view attachments for their assigned tasks"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_id
            AND tasks.assigned_to = auth.uid()
        )
    );

CREATE POLICY "Admins can view all task attachments"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Users can upload attachments for their assigned tasks"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_id
            AND tasks.assigned_to = auth.uid()
        )
        AND uploaded_by = auth.uid()
    );

CREATE POLICY "Users can update their own attachments"
    ON public.task_attachments FOR UPDATE
    TO authenticated
    USING (uploaded_by = auth.uid())
    WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (uploaded_by = auth.uid());

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task attachments
CREATE POLICY "Anyone can view task attachment files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task attachment files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Users can update their own task attachment files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own task attachment files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Test the setup
DO $$
BEGIN
    RAISE NOTICE 'Task attachments table created successfully';
    RAISE NOTICE 'Available policies:';
    RAISE NOTICE '- Users can view attachments for their assigned tasks';
    RAISE NOTICE '- Admins can view all task attachments';
    RAISE NOTICE '- Users can upload attachments for their assigned tasks';
    RAISE NOTICE '- Users can update/delete their own attachments';
END $$;
