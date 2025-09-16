-- Quick fix for geofence RLS policy issue
-- Run this in your Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage geofences" ON public.geofences;
DROP POLICY IF EXISTS "Employees can view active geofences" ON public.geofences;
DROP POLICY IF EXISTS "Allow authenticated users to insert geofences" ON public.geofences;

-- Create new policies with proper WITH CHECK clauses
CREATE POLICY "Admins can manage geofences"
    ON public.geofences FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can view active geofences"
    ON public.geofences FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Temporary policy to allow all authenticated users to insert geofences
CREATE POLICY "Allow authenticated users to insert geofences"
    ON public.geofences FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'geofences';
