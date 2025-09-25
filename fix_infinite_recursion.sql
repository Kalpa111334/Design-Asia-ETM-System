-- Fix infinite recursion in RLS policies
-- Run this in your Supabase SQL Editor

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;

-- Create simple policies that don't cause recursion
-- Policy for viewing users - use auth metadata instead of querying users table
CREATE POLICY "Users can view profiles"
  ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR (
      auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy for updating users
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Policy for inserting users - allow all authenticated users to insert
CREATE POLICY "Authenticated users can insert"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Success message
SELECT 'Infinite recursion fix applied successfully!' as message;
