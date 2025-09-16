-- ========================================
-- QUICK TEST TO VERIFY ATTACHMENTS
-- ========================================

-- 1. Check if table exists
SELECT 
    'Table exists: ' || CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_attachments')
        THEN 'YES'
        ELSE 'NO'
    END as result;

-- 2. Count total attachments
SELECT 
    'Total attachments: ' || COUNT(*) as result
FROM public.task_attachments;

-- 3. Count tasks with attachments
SELECT 
    'Tasks with attachments: ' || COUNT(DISTINCT task_id) as result
FROM public.task_attachments;

-- 4. Show sample data
SELECT 
    'Sample attachments:' as result,
    file_name,
    file_type,
    task_id
FROM public.task_attachments
LIMIT 3;

-- 5. Check if any tasks are assigned to users
SELECT 
    'Assigned tasks: ' || COUNT(*) as result
FROM public.tasks
WHERE assigned_to IS NOT NULL;

-- 6. Show tasks and their attachment counts
SELECT 
    t.id,
    t.title,
    t.assigned_to,
    COUNT(ta.id) as attachment_count
FROM public.tasks t
LEFT JOIN public.task_attachments ta ON ta.task_id = t.id
WHERE t.assigned_to IS NOT NULL
GROUP BY t.id, t.title, t.assigned_to
ORDER BY attachment_count DESC
LIMIT 5;
