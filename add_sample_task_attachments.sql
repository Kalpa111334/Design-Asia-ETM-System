-- Add sample task attachments to test the eye icon functionality
-- This script adds sample attachments to existing tasks

-- First, let's see what tasks exist
-- SELECT id, title FROM tasks LIMIT 5;

-- Add sample attachments to the first few tasks
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Task Requirements Document.pdf',
    1024000,
    'application/pdf',
    'https://example.com/attachments/requirements.pdf',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 3
)
ON CONFLICT DO NOTHING;

-- Add another sample attachment
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Project Guidelines.docx',
    512000,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'https://example.com/attachments/guidelines.docx',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 2
)
ON CONFLICT DO NOTHING;

-- Add an image attachment
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    t.id,
    'Reference Image.jpg',
    2048000,
    'image/jpeg',
    'https://example.com/attachments/reference.jpg',
    t.created_by
FROM public.tasks t
WHERE t.id IN (
    SELECT id FROM public.tasks 
    ORDER BY created_at DESC 
    LIMIT 1
)
ON CONFLICT DO NOTHING;

-- Verify the attachments were added
SELECT 
    ta.id,
    ta.file_name,
    ta.file_type,
    ta.file_size,
    t.title as task_title
FROM public.task_attachments ta
JOIN public.tasks t ON t.id = ta.task_id
ORDER BY ta.created_at DESC;
