-- Fix RLS policy to allow admins to insert new users
-- Run this in your Supabase SQL Editor

-- Drop existing insert policy
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;

-- Create new policy that allows admins to insert users
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Also create a policy for users to insert their own record (for signup)
CREATE POLICY "Users can insert their own record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
