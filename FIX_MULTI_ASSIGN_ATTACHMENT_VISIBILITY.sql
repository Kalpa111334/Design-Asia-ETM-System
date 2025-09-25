-- ========================================
-- FIX ATTACHMENT VISIBILITY FOR MULTI-ASSIGNED TASKS
-- ========================================
-- This script fixes the issue where task attachments are not visible 
-- to employees when tasks are assigned to multiple employees via task_assignees table

-- Step 1: Drop all existing task_attachments policies to start fresh
DROP POLICY IF EXISTS "Users can view attachments for their assigned tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Admins can view all task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can upload attachments for their assigned tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can update their own attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to view attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to insert attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to update attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all authenticated users to delete attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "View attachments for assigned tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Admins can view all attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "View attachments for created tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Insert attachments for assigned tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Admins can insert attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Update own attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Delete own attachments" ON public.task_attachments;

-- Step 2: Create comprehensive policies that handle both direct assignment and multi-assignment

-- Policy 1: Users can view attachments for tasks assigned to them (direct or via task_assignees)
CREATE POLICY "Users can view attachments for assigned tasks"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        -- Direct assignment via tasks.assigned_to
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_attachments.task_id
            AND tasks.assigned_to = auth.uid()
        )
        OR
        -- Multi-assignment via task_assignees table
        EXISTS (
            SELECT 1 FROM public.task_assignees ta
            WHERE ta.task_id = task_attachments.task_id
            AND ta.user_id = auth.uid()
        )
    );

-- Policy 2: Admins can view all attachments
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

-- Policy 3: Users can view attachments for tasks they created
CREATE POLICY "Users can view attachments for created tasks"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_attachments.task_id
            AND tasks.created_by = auth.uid()
        )
    );

-- Policy 4: Users can insert attachments for tasks assigned to them (direct or via task_assignees)
CREATE POLICY "Users can insert attachments for assigned tasks"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            -- Direct assignment via tasks.assigned_to
            EXISTS (
                SELECT 1 FROM public.tasks
                WHERE tasks.id = task_attachments.task_id
                AND tasks.assigned_to = auth.uid()
            )
            OR
            -- Multi-assignment via task_assignees table
            EXISTS (
                SELECT 1 FROM public.task_assignees ta
                WHERE ta.task_id = task_attachments.task_id
                AND ta.user_id = auth.uid()
            )
        )
        AND uploaded_by = auth.uid()
    );

-- Policy 5: Admins can insert attachments for any task
CREATE POLICY "Admins can insert attachments for any task"
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

-- Policy 6: Task creators can insert attachments for tasks they created
CREATE POLICY "Task creators can insert attachments"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_attachments.task_id
            AND tasks.created_by = auth.uid()
        )
        AND uploaded_by = auth.uid()
    );

-- Policy 7: Users can update their own attachments
CREATE POLICY "Users can update own attachments"
    ON public.task_attachments FOR UPDATE
    TO authenticated
    USING (uploaded_by = auth.uid())
    WITH CHECK (uploaded_by = auth.uid());

-- Policy 8: Users can delete their own attachments
CREATE POLICY "Users can delete own attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (uploaded_by = auth.uid());

-- Step 3: Ensure the table exists with correct structure
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

-- Enable RLS if not already enabled
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Step 4: Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Fix storage policies
DROP POLICY IF EXISTS "Anyone can view task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "View task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Upload task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Update own task attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Delete own task attachment files" ON storage.objects;

-- Allow anyone to view task attachment files (public bucket)
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

-- Step 6: Test the policies by showing current RLS policies
SELECT 
    'SUCCESS: Multi-assignment attachment visibility policies updated!' as status;

-- Show current policies for verification
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    substr(qual, 1, 100) as qual_preview,
    substr(with_check, 1, 100) as with_check_preview
FROM pg_policies 
WHERE tablename = 'task_attachments'
ORDER BY policyname;

-- Step 7: Test query to verify multi-assignment attachment visibility
-- This query should return attachments for tasks assigned to the current user via either method
SELECT 
    'Test Query Results' as info,
    COUNT(*) as total_attachments_visible
FROM public.task_attachments ta
WHERE 
    -- Direct assignment
    EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = ta.task_id
        AND t.assigned_to = auth.uid()
    )
    OR
    -- Multi-assignment
    EXISTS (
        SELECT 1 FROM public.task_assignees tas
        WHERE tas.task_id = ta.task_id
        AND tas.user_id = auth.uid()
    );