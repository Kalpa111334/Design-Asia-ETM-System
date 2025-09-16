-- Fix permission denied error by temporarily disabling RLS
-- Run this in your Supabase SQL Editor

-- Step 1: Create the is_admin function first
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user exists in auth.users and has admin role in metadata
    RETURN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Temporarily disable RLS on users table to allow access
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop all existing policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', policy_record.policyname);
    END LOOP;
END $$;

-- Step 4: Create very simple policies that won't cause recursion

-- Allow all authenticated users to read users table
CREATE POLICY "Allow all authenticated users to read"
    ON public.users FOR SELECT
    TO authenticated
    USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Allow all authenticated users to insert"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow users to update their own records
CREATE POLICY "Allow users to update own record"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow admins to delete (using the function)
CREATE POLICY "Allow admins to delete"
    ON public.users FOR DELETE
    TO authenticated
    USING (is_admin());

-- Step 5: Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 6: Test the function
SELECT 
    auth.uid() as current_user_id,
    is_admin() as is_current_user_admin;

-- Step 7: Verify policies
SELECT 
    policyname, 
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;
