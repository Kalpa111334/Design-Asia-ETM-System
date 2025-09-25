-- Fix geofences table RLS policies
-- Run this in your Supabase SQL Editor

-- First, create the is_admin function if it doesn't exist
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

-- Disable RLS temporarily
ALTER TABLE public.geofences DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on geofences table
DROP POLICY IF EXISTS "Admins can manage geofences" ON public.geofences;
DROP POLICY IF EXISTS "Employees can view active geofences" ON public.geofences;
DROP POLICY IF EXISTS "Allow authenticated users to insert geofences" ON public.geofences;

-- Create simple, non-recursive policies

-- Policy 1: Admins can manage geofences (using the is_admin function)
CREATE POLICY "Admins can manage geofences"
    ON public.geofences FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Policy 2: Employees can view active geofences
CREATE POLICY "Employees can view active geofences"
    ON public.geofences FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Policy 3: Allow authenticated users to insert geofences (temporary)
CREATE POLICY "Allow authenticated users to insert geofences"
    ON public.geofences FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Re-enable RLS
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

-- Verify policies are created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'geofences'
ORDER BY policyname;
