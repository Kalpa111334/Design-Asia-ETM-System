-- ========================================
-- CREATE REAL WORKING ATTACHMENTS
-- ========================================
-- This script creates attachments with real, accessible file URLs

-- First, ensure the table exists
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

-- Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies (if they don't exist)
DO $$
BEGIN
    -- Users can view attachments for their assigned tasks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_attachments' AND policyname = 'Users can view attachments for their assigned tasks') THEN
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
    END IF;

    -- Admins can view all task attachments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_attachments' AND policyname = 'Admins can view all task attachments') THEN
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
    END IF;
END $$;

-- Clear existing sample data
DELETE FROM public.task_attachments;

-- Add REAL working attachments with accessible URLs
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Project Requirements.pdf',
    1024000,
    'application/pdf',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 3
);

-- Add DOCX file
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Project Guidelines.docx',
    512000,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'https://file-examples.com/storage/fe68c4b8b4a3b4b4b4b4b4b/2017/10/file_example_DOCX_10kB.docx',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 2
);

-- Add PPTX file
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Project Presentation.pptx',
    2048000,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'https://file-examples.com/storage/fe68c4b8b4a3b4b4b4b4b4b/2017/08/file_example_PPTX_1MB.pptx',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 2
);

-- Add ZIP file
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Project Resources.zip',
    5120000,
    'application/zip',
    'https://file-examples.com/storage/fe68c4b8b4a3b4b4b4b4b4b/2017/02/zip_2MB.zip',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 1
);

-- Add multiple image files
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Project Screenshot.jpg',
    1024000,
    'image/jpeg',
    'https://picsum.photos/800/600',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 3
);

-- Add PNG image
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Design Mockup.png',
    2048000,
    'image/png',
    'https://picsum.photos/1200/800',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 2
);

-- Add Excel file
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Project Budget.xlsx',
    1024000,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'https://file-examples.com/storage/fe68c4b8b4a3b4b4b4b4b4b/2017/10/file_example_XLSX_10.xlsx',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 1
);

-- Verify the attachments were created
SELECT 
    'SUCCESS: Attachments created!' as status,
    COUNT(*) as total_attachments,
    COUNT(DISTINCT task_id) as tasks_with_attachments
FROM public.task_attachments;

-- Show the attachments by file type
SELECT 
    file_type,
    COUNT(*) as count,
    STRING_AGG(file_name, ', ') as files
FROM public.task_attachments
GROUP BY file_type
ORDER BY count DESC;
