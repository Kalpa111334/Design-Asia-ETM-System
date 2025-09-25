-- ========================================
-- TEST ADMIN TO EMPLOYEE ATTACHMENT FLOW
-- ========================================

-- Step 1: Check if we have tasks with attachments
SELECT 
    'Current attachment status:' as test,
    COUNT(*) as total_attachments,
    COUNT(DISTINCT task_id) as tasks_with_attachments
FROM public.task_attachments;

-- Step 2: Show tasks and their attachment counts
SELECT 
    'Tasks with attachments:' as test,
    t.id,
    t.title,
    t.assigned_to,
    u.full_name as assigned_to_name,
    u.role as assigned_to_role,
    COUNT(ta.id) as attachment_count,
    STRING_AGG(ta.file_name, ', ') as attachment_files
FROM public.tasks t
LEFT JOIN public.task_attachments ta ON ta.task_id = t.id
LEFT JOIN public.users u ON u.id = t.assigned_to
WHERE t.assigned_to IS NOT NULL
GROUP BY t.id, t.title, t.assigned_to, u.full_name, u.role
ORDER BY attachment_count DESC;

-- Step 3: Test RLS policies by simulating employee view
-- This query should work for employees viewing their assigned tasks
SELECT 
    'Employee view test:' as test,
    ta.id,
    ta.file_name,
    ta.file_type,
    ta.file_url,
    t.title as task_title,
    t.assigned_to
FROM public.task_attachments ta
JOIN public.tasks t ON t.id = ta.task_id
WHERE t.assigned_to IS NOT NULL
LIMIT 5;

-- Step 4: Check if attachments are properly linked to tasks
SELECT 
    'Attachment-Task linkage test:' as test,
    ta.task_id,
    t.title as task_title,
    t.assigned_to,
    ta.file_name,
    ta.file_type,
    CASE 
        WHEN ta.file_url IS NOT NULL AND ta.file_url != '' THEN 'Has URL'
        ELSE 'Missing URL'
    END as url_status
FROM public.task_attachments ta
LEFT JOIN public.tasks t ON t.id = ta.task_id
ORDER BY ta.created_at DESC
LIMIT 10;

-- Step 5: Verify storage bucket exists
SELECT 
    'Storage bucket test:' as test,
    id,
    name,
    public,
    created_at
FROM storage.buckets 
WHERE id = 'task-attachments';

-- Step 6: Check storage policies
SELECT 
    'Storage policies test:' as test,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%task%'
ORDER BY policyname;

-- Step 7: Show sample attachment data
SELECT 
    'Sample attachment data:' as test,
    ta.id,
    ta.file_name,
    ta.file_type,
    ta.file_size,
    ta.file_url,
    ta.uploaded_by,
    u.full_name as uploaded_by_name,
    u.role as uploaded_by_role,
    t.title as task_title,
    t.assigned_to,
    assigned_user.full_name as assigned_to_name
FROM public.task_attachments ta
LEFT JOIN public.users u ON u.id = ta.uploaded_by
LEFT JOIN public.tasks t ON t.id = ta.task_id
LEFT JOIN public.users assigned_user ON assigned_user.id = t.assigned_to
ORDER BY ta.created_at DESC
LIMIT 5;
