-- ========================================
-- FIX RLS POLICIES FOR ATTACHMENT VISIBILITY
-- ========================================

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Users can view attachments for their assigned tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Admins can view all task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can upload attachments for their assigned tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can update their own attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to view attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to insert attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to update attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to delete attachments" ON public.task_attachments;

-- Step 2: Create comprehensive policies that work for both admins and employees

-- Policy 1: Anyone can view attachments for tasks assigned to them
CREATE POLICY "View attachments for assigned tasks"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_attachments.task_id
            AND tasks.assigned_to = auth.uid()
        )
    );

-- Policy 2: Admins can view all attachments
CREATE POLICY "Admins can view all attachments"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Policy 3: Anyone can view attachments for tasks they created
CREATE POLICY "View attachments for created tasks"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_attachments.task_id
            AND tasks.created_by = auth.uid()
        )
    );

-- Policy 4: Anyone can insert attachments for tasks assigned to them
CREATE POLICY "Insert attachments for assigned tasks"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_attachments.task_id
            AND tasks.assigned_to = auth.uid()
        )
        AND uploaded_by = auth.uid()
    );

-- Policy 5: Admins can insert attachments for any task
CREATE POLICY "Admins can insert attachments"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
        AND uploaded_by = auth.uid()
    );

-- Policy 6: Anyone can update their own attachments
CREATE POLICY "Update own attachments"
    ON public.task_attachments FOR UPDATE
    TO authenticated
    USING (uploaded_by = auth.uid())
    WITH CHECK (uploaded_by = auth.uid());

-- Policy 7: Anyone can delete their own attachments
CREATE POLICY "Delete own attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (uploaded_by = auth.uid());

-- Step 3: Ensure the table exists
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

-- Step 4: Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Fix storage policies
DROP POLICY IF EXISTS "Anyone can view task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task attachment files" ON storage.objects;

-- Allow anyone to view task attachment files
CREATE POLICY "View task attachment files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'task-attachments');

-- Allow authenticated users to upload task attachment files
CREATE POLICY "Upload task attachment files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'task-attachments');

-- Allow users to update their own task attachment files
CREATE POLICY "Update own task attachment files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own task attachment files
CREATE POLICY "Delete own task attachment files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Step 6: Test the policies
SELECT 'RLS policies updated successfully!' as status;

-- Step 7: Show current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'task_attachments'
ORDER BY policyname;
