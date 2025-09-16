-- Fix missing employees by syncing auth.users to public.users
-- Run this in your Supabase SQL Editor

-- Step 1: Create a function to sync users from auth.users to public.users
CREATE OR REPLACE FUNCTION sync_auth_users_to_public()
RETURNS INTEGER AS $$
DECLARE
    synced_count INTEGER := 0;
    auth_user RECORD;
BEGIN
    -- Loop through all authenticated users
    FOR auth_user IN 
        SELECT 
            au.id,
            au.email,
            COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
            COALESCE(au.raw_user_meta_data->>'role', 'employee') as role,
            au.created_at
        FROM auth.users au
        WHERE au.email_confirmed_at IS NOT NULL
    LOOP
        -- Check if user already exists in public.users
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth_user.id) THEN
            -- Insert user into public.users
            INSERT INTO public.users (id, email, full_name, role, created_at)
            VALUES (
                auth_user.id,
                auth_user.email,
                auth_user.full_name,
                auth_user.role,
                auth_user.created_at
            );
            synced_count := synced_count + 1;
        END IF;
    END LOOP;
    
    RETURN synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create a trigger to automatically sync new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new user into public.users when they sign up
    INSERT INTO public.users (id, email, full_name, role, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
        NEW.created_at
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- User already exists, ignore
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger (if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 4: Sync existing users
SELECT sync_auth_users_to_public() as users_synced;

-- Step 5: Verify the sync worked
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

-- Step 6: Show all users in public.users
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM public.users
ORDER BY created_at DESC;

-- Step 7: Check for any users that might be missing
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'full_name' as auth_name,
    au.raw_user_meta_data->>'role' as auth_role,
    pu.full_name as public_name,
    pu.role as public_role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email_confirmed_at IS NOT NULL
ORDER BY au.created_at DESC;
