-- Fix unknown employee issue by ensuring user data is properly populated
-- Run this in your Supabase SQL Editor

-- Step 1: Create a function to get user display name
CREATE OR REPLACE FUNCTION get_user_display_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_name TEXT;
    user_email TEXT;
BEGIN
    -- Try to get user from public.users first
    SELECT full_name, email INTO user_name, user_email
    FROM public.users 
    WHERE id = user_id;
    
    -- If found, return the name
    IF user_name IS NOT NULL AND user_name != '' THEN
        RETURN user_name;
    END IF;
    
    -- If not found in public.users, try auth.users
    SELECT raw_user_meta_data->>'full_name', email INTO user_name, user_email
    FROM auth.users 
    WHERE id = user_id;
    
    -- Return the best available name
    IF user_name IS NOT NULL AND user_name != '' THEN
        RETURN user_name;
    ELSIF user_email IS NOT NULL THEN
        RETURN split_part(user_email, '@', 1);
    ELSE
        RETURN 'User ' || substring(user_id::text, 1, 8);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create a function to get user email
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Try to get email from public.users first
    SELECT email INTO user_email
    FROM public.users 
    WHERE id = user_id;
    
    -- If found, return it
    IF user_email IS NOT NULL THEN
        RETURN user_email;
    END IF;
    
    -- If not found, try auth.users
    SELECT email INTO user_email
    FROM auth.users 
    WHERE id = user_id;
    
    RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Drop and recreate the get_latest_employee_locations RPC function
DROP FUNCTION IF EXISTS get_latest_employee_locations();

-- Create the function with improved user data fetching
CREATE OR REPLACE FUNCTION get_latest_employee_locations()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ,
    battery_level INTEGER,
    connection_status TEXT,
    location_accuracy DOUBLE PRECISION,
    task_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        el.id,
        el.user_id,
        el.latitude,
        el.longitude,
        el.timestamp as recorded_at,
        el.battery_level,
        el.connection_status,
        el.location_accuracy,
        el.task_id,
        COALESCE(
            u.full_name,
            au.raw_user_meta_data->>'full_name',
            split_part(COALESCE(u.email, au.email), '@', 1),
            'User ' || substring(el.user_id::text, 1, 8)
        ) as full_name,
        u.avatar_url,
        COALESCE(u.email, au.email) as email
    FROM (
        SELECT DISTINCT ON (user_id) 
            el_inner.*
        FROM employee_locations el_inner
        ORDER BY user_id, timestamp DESC
    ) el
    LEFT JOIN public.users u ON el.user_id = u.id
    LEFT JOIN auth.users au ON el.user_id = au.id
    ORDER BY el.timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Test the functions
SELECT 
    auth.uid() as current_user_id,
    get_user_display_name(auth.uid()) as display_name,
    get_user_email(auth.uid()) as email;

-- Step 5: Verify the RPC function works
SELECT * FROM get_latest_employee_locations() LIMIT 5;
