-- ========================================
-- TEST ATTACHMENTS SETUP
-- ========================================
-- Run this to diagnose attachment issues

-- 1. Check if table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_attachments')
        THEN '✅ Table EXISTS'
        ELSE '❌ Table MISSING'
    END as table_status;

-- 2. Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'task_attachments'
ORDER BY ordinal_position;

-- 3. Check if there are any attachments
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Has ' || COUNT(*) || ' attachments'
        ELSE '❌ No attachments found'
    END as attachment_status
FROM public.task_attachments;

-- 4. Check RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'task_attachments';

-- 5. Show sample attachments
SELECT 
    ta.id,
    ta.file_name,
    ta.file_type,
    ta.file_size,
    ta.file_url,
    t.title as task_title,
    u.full_name as uploaded_by
FROM public.task_attachments ta
JOIN public.tasks t ON t.id = ta.task_id
LEFT JOIN public.users u ON u.id = ta.uploaded_by
ORDER BY ta.created_at DESC
LIMIT 5;

-- 6. Check which tasks have attachments
SELECT 
    t.id,
    t.title,
    t.assigned_to,
    COUNT(ta.id) as attachment_count,
    STRING_AGG(ta.file_name, ', ') as attachment_files
FROM public.tasks t
LEFT JOIN public.task_attachments ta ON ta.task_id = t.id
GROUP BY t.id, t.title, t.assigned_to
ORDER BY attachment_count DESC
LIMIT 10;
