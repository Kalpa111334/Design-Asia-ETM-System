-- ========================================
-- TEST MULTI-ASSIGNMENT ATTACHMENT FIX
-- ========================================
-- This script tests that the multi-assignment attachment visibility fix works correctly

-- Step 1: Show current state
SELECT 'CURRENT STATE BEFORE TEST' as info;

-- Show existing users
SELECT 
    'USERS' as table_name,
    id,
    email,
    full_name,
    role
FROM public.users
WHERE role IN ('admin', 'employee')
ORDER BY role, full_name;

-- Show existing tasks
SELECT 
    'TASKS' as table_name,
    id,
    title,
    assigned_to,
    created_by,
    status
FROM public.tasks
ORDER BY created_at DESC
LIMIT 5;

-- Show task_assignees
SELECT 
    'TASK_ASSIGNEES' as table_name,
    ta.task_id,
    t.title as task_title,
    ta.user_id,
    u.full_name as assigned_employee
FROM public.task_assignees ta
JOIN public.tasks t ON t.id = ta.task_id
JOIN public.users u ON u.id = ta.user_id
ORDER BY t.title, u.full_name;

-- Show task_attachments
SELECT 
    'TASK_ATTACHMENTS' as table_name,
    ta.id,
    ta.task_id,
    t.title as task_title,
    ta.file_name,
    ta.uploaded_by,
    u.full_name as uploaded_by_name
FROM public.task_attachments ta
JOIN public.tasks t ON t.id = ta.task_id
LEFT JOIN public.users u ON u.id = ta.uploaded_by
ORDER BY t.title, ta.file_name;

-- Step 2: Create test scenario
SELECT 'CREATING TEST SCENARIO' as info;

-- Get some employees for testing
WITH test_employees AS (
    SELECT id, full_name, email
    FROM public.users
    WHERE role = 'employee'
    LIMIT 3
),
admin_user AS (
    SELECT id
    FROM public.users
    WHERE role = 'admin'
    LIMIT 1
)
-- Create a test task
INSERT INTO public.tasks (id, title, description, priority, assigned_to, due_date, start_date, end_date, time_assigning, estimated_time, price, status, created_by)
SELECT 
    uuid_generate_v4() as id,
    'Multi-Assignment Test Task' as title,
    'This task is assigned to multiple employees to test attachment visibility' as description,
    'High' as priority,
    (SELECT id FROM test_employees LIMIT 1) as assigned_to, -- Primary assignee
    CURRENT_DATE + INTERVAL '7 days' as due_date,
    CURRENT_TIMESTAMP as start_date,
    CURRENT_TIMESTAMP + INTERVAL '1 day' as end_date,
    120 as time_assigning, -- 2 hours
    120 as estimated_time,
    5000 as price,
    'Planned' as status,
    (SELECT id FROM admin_user) as created_by
WHERE EXISTS (SELECT 1 FROM test_employees) AND EXISTS (SELECT 1 FROM admin_user);

-- Get the task ID we just created
WITH new_task AS (
    SELECT id
    FROM public.tasks
    WHERE title = 'Multi-Assignment Test Task'
    ORDER BY created_at DESC
    LIMIT 1
),
test_employees AS (
    SELECT id, full_name, email, row_number() over (order by full_name) as rn
    FROM public.users
    WHERE role = 'employee'
    LIMIT 3
)
-- Assign the task to multiple employees via task_assignees
INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
SELECT 
    nt.id as task_id,
    te.id as user_id,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1) as assigned_by
FROM new_task nt
CROSS JOIN test_employees te
WHERE EXISTS (SELECT 1 FROM new_task) AND EXISTS (SELECT 1 FROM test_employees);

-- Add test attachments to the multi-assigned task
WITH new_task AS (
    SELECT id
    FROM public.tasks
    WHERE title = 'Multi-Assignment Test Task'
    ORDER BY created_at DESC
    LIMIT 1
)
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    nt.id as task_id,
    'Multi-Assignment-Test-Document.pdf' as file_name,
    1024000 as file_size,
    'application/pdf' as file_type,
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' as file_url,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1) as uploaded_by
FROM new_task nt
WHERE EXISTS (SELECT 1 FROM new_task);

-- Add another attachment
WITH new_task AS (
    SELECT id
    FROM public.tasks
    WHERE title = 'Multi-Assignment Test Task'
    ORDER BY created_at DESC
    LIMIT 1
)
INSERT INTO public.task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
SELECT 
    nt.id as task_id,
    'Multi-Assignment-Test-Image.jpg' as file_name,
    2048000 as file_size,
    'image/jpeg' as file_type,
    'https://picsum.photos/800/600' as file_url,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1) as uploaded_by
FROM new_task nt
WHERE EXISTS (SELECT 1 FROM new_task);

-- Step 3: Verify the test setup
SELECT 'TEST SETUP VERIFICATION' as info;

-- Show the multi-assigned task
SELECT 
    'MULTI-ASSIGNED TASK' as info,
    t.id,
    t.title,
    t.assigned_to as primary_assignee,
    u1.full_name as primary_assignee_name,
    t.created_by,
    u2.full_name as created_by_name
FROM public.tasks t
LEFT JOIN public.users u1 ON u1.id = t.assigned_to
LEFT JOIN public.users u2 ON u2.id = t.created_by
WHERE t.title = 'Multi-Assignment Test Task';

-- Show all assignees for the test task
SELECT 
    'TASK ASSIGNEES' as info,
    ta.task_id,
    ta.user_id,
    u.full_name as assignee_name,
    u.email as assignee_email
FROM public.task_assignees ta
JOIN public.users u ON u.id = ta.user_id
JOIN public.tasks t ON t.id = ta.task_id
WHERE t.title = 'Multi-Assignment Test Task'
ORDER BY u.full_name;

-- Show attachments for the test task
SELECT 
    'TASK ATTACHMENTS' as info,
    ta.id as attachment_id,
    ta.task_id,
    ta.file_name,
    ta.file_type,
    ta.uploaded_by,
    u.full_name as uploaded_by_name
FROM public.task_attachments ta
LEFT JOIN public.users u ON u.id = ta.uploaded_by
JOIN public.tasks t ON t.id = ta.task_id
WHERE t.title = 'Multi-Assignment Test Task'
ORDER BY ta.file_name;

-- Step 4: Test attachment visibility for each assigned employee
SELECT 'TESTING ATTACHMENT VISIBILITY' as info;

-- This query simulates what each employee should see
-- It tests the RLS policy we created
WITH test_task AS (
    SELECT id
    FROM public.tasks
    WHERE title = 'Multi-Assignment Test Task'
    LIMIT 1
),
assigned_employees AS (
    SELECT DISTINCT ta.user_id, u.full_name, u.email
    FROM public.task_assignees ta
    JOIN public.users u ON u.id = ta.user_id
    JOIN test_task tt ON tt.id = ta.task_id
)
SELECT 
    'ATTACHMENT VISIBILITY TEST' as test_type,
    ae.full_name as employee_name,
    ae.email as employee_email,
    COUNT(attachments.id) as visible_attachments,
    STRING_AGG(attachments.file_name, ', ') as attachment_files
FROM assigned_employees ae
LEFT JOIN (
    -- This subquery simulates the RLS policy check
    SELECT ta.*
    FROM public.task_attachments ta
    JOIN test_task tt ON tt.id = ta.task_id
    WHERE 
        -- Direct assignment check
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = ta.task_id
            AND t.assigned_to = ae.user_id
        )
        OR
        -- Multi-assignment check
        EXISTS (
            SELECT 1 FROM public.task_assignees tas
            WHERE tas.task_id = ta.task_id
            AND tas.user_id = ae.user_id
        )
) attachments ON TRUE
GROUP BY ae.user_id, ae.full_name, ae.email
ORDER BY ae.full_name;

-- Step 5: Test the v_user_tasks view
SELECT 'TESTING V_USER_TASKS VIEW' as info;

-- Show what each assigned employee should see via the view
WITH assigned_employees AS (
    SELECT DISTINCT ta.user_id, u.full_name
    FROM public.task_assignees ta
    JOIN public.users u ON u.id = ta.user_id
    JOIN public.tasks t ON t.id = ta.task_id
    WHERE t.title = 'Multi-Assignment Test Task'
)
SELECT 
    'V_USER_TASKS TEST' as test_type,
    ae.full_name as employee_name,
    COUNT(*) as visible_tasks,
    STRING_AGG(vut.title, ', ') as task_titles
FROM assigned_employees ae
LEFT JOIN public.v_user_tasks vut ON (
    vut.assigned_to = ae.user_id OR 
    EXISTS (
        SELECT 1 FROM public.task_assignees ta2
        WHERE ta2.task_id = vut.id AND ta2.user_id = ae.user_id
    )
)
WHERE vut.title = 'Multi-Assignment Test Task'
GROUP BY ae.user_id, ae.full_name
ORDER BY ae.full_name;

-- Step 6: Test the complete query that the frontend uses
SELECT 'TESTING FRONTEND QUERY SIMULATION' as info;

-- Simulate the query from Tasks.tsx for each employee
WITH test_employees AS (
    SELECT ta.user_id, u.full_name
    FROM public.task_assignees ta
    JOIN public.users u ON u.id = ta.user_id
    JOIN public.tasks t ON t.id = ta.task_id
    WHERE t.title = 'Multi-Assignment Test Task'
    LIMIT 1 -- Test with one employee
)
SELECT 
    'FRONTEND QUERY TEST' as test_type,
    te.full_name as testing_for_employee,
    t.id as task_id,
    t.title,
    t.assigned_to,
    COUNT(ta.id) as attachment_count,
    STRING_AGG(ta.file_name, ', ') as attachments
FROM test_employees te
JOIN public.tasks t ON (
    t.assigned_to = te.user_id OR 
    EXISTS (
        SELECT 1 FROM public.task_assignees tas
        WHERE tas.task_id = t.id AND tas.user_id = te.user_id
    )
)
LEFT JOIN public.task_attachments ta ON ta.task_id = t.id
WHERE t.title = 'Multi-Assignment Test Task'
GROUP BY te.user_id, te.full_name, t.id, t.title, t.assigned_to
ORDER BY te.full_name;

-- Step 7: Summary
SELECT 
    'TEST SUMMARY' as info,
    'Multi-assignment attachment fix test completed' as status,
    'Check the results above to verify all assigned employees can see the attachments' as instructions;

-- Clean up test data (optional - uncomment to clean up)
-- DELETE FROM public.task_attachments WHERE task_id IN (
--     SELECT id FROM public.tasks WHERE title = 'Multi-Assignment Test Task'
-- );
-- DELETE FROM public.task_assignees WHERE task_id IN (
--     SELECT id FROM public.tasks WHERE title = 'Multi-Assignment Test Task'
-- );
-- DELETE FROM public.tasks WHERE title = 'Multi-Assignment Test Task';