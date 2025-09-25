-- Fix missing users in public.users table
-- Run this in your Supabase SQL Editor

-- Insert missing users from auth.users into public.users
INSERT INTO public.users (id, email, full_name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
    COALESCE(au.raw_user_meta_data->>'role', 'employee') as role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
AND au.email_confirmed_at IS NOT NULL;

-- Verify the fix
SELECT 
    'auth.users' as source,
    COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NOT NULL

UNION ALL

SELECT 
    'public.users' as source,
    COUNT(*) as count
FROM public.users;

-- Check for any remaining foreign key issues
SELECT 
    g.id as geofence_id,
    g.name,
    g.created_by,
    u.email as user_email,
    u.role as user_role
FROM public.geofences g
LEFT JOIN public.users u ON g.created_by = u.id
WHERE u.id IS NULL;
