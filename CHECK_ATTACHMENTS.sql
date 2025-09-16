-- ========================================
-- CHECK IF ATTACHMENTS ARE WORKING
-- ========================================
-- Run this to verify your setup

-- Check if task_attachments table exists
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'task_attachments';

-- Check if there are any attachments
SELECT 
    COUNT(*) as total_attachments,
    COUNT(DISTINCT task_id) as tasks_with_attachments
FROM public.task_attachments;

-- Show sample attachments
SELECT 
    ta.file_name,
    ta.file_type,
    ta.file_size,
    t.title as task_title,
    u.full_name as uploaded_by
FROM public.task_attachments ta
JOIN public.tasks t ON t.id = ta.task_id
LEFT JOIN public.users u ON u.id = ta.uploaded_by
LIMIT 5;

-- Check if tasks are fetching attachments correctly
SELECT 
    t.id,
    t.title,
    COUNT(ta.id) as attachment_count
FROM public.tasks t
LEFT JOIN public.task_attachments ta ON ta.task_id = t.id
GROUP BY t.id, t.title
ORDER BY attachment_count DESC
LIMIT 10;
