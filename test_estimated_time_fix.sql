-- Test script to verify estimated_time field is working
-- Run this in your Supabase SQL Editor

-- Step 1: Check the current tasks table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check if there are any existing tasks with null estimated_time
SELECT 
    id,
    title,
    estimated_time,
    time_assigning,
    created_at
FROM tasks 
WHERE estimated_time IS NULL
ORDER BY created_at DESC;

-- Step 3: Update any existing tasks that have null estimated_time
UPDATE tasks 
SET estimated_time = COALESCE(time_assigning, 60) -- Default to 60 minutes if both are null
WHERE estimated_time IS NULL;

-- Step 4: Verify the update worked
SELECT 
    COUNT(*) as total_tasks,
    COUNT(estimated_time) as tasks_with_estimated_time,
    COUNT(*) - COUNT(estimated_time) as tasks_with_null_estimated_time
FROM tasks;

-- Step 5: Show sample of updated tasks
SELECT 
    id,
    title,
    estimated_time,
    time_assigning,
    status,
    created_at
FROM tasks 
ORDER BY created_at DESC 
LIMIT 5;
