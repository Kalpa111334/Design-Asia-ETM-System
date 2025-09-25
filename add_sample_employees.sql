-- Add sample employees to make them visible in the system
-- Run this in your Supabase SQL Editor

-- Step 1: Insert sample employees into public.users table
-- Replace these with actual employee data from your auth.users table

-- First, let's see what users exist in auth.users
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users
WHERE email_confirmed_at IS NOT NULL
ORDER BY created_at DESC;

-- Step 2: Insert missing users into public.users
-- This will insert users from auth.users that don't exist in public.users
INSERT INTO public.users (id, email, full_name, role, created_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
    COALESCE(au.raw_user_meta_data->>'role', 'employee') as role,
    au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email_confirmed_at IS NOT NULL
AND pu.id IS NULL;

-- Step 3: Verify the insert worked
SELECT 
    'After insert - public.users' as source,
    COUNT(*) as count
FROM public.users

UNION ALL

SELECT 
    'After insert - auth.users' as source,
    COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NOT NULL;

-- Step 4: Show all users now in public.users
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM public.users
ORDER BY created_at DESC;

-- Step 5: If you need to manually add specific employees, use this format:
-- INSERT INTO public.users (id, email, full_name, role, created_at)
-- VALUES (
--     'user-uuid-here',
--     'employee@company.com',
--     'Employee Name',
--     'employee',
--     NOW()
-- );
