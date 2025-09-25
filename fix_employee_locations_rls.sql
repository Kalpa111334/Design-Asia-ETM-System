-- Fix RLS policy for employee_locations
-- The current policy uses auth.jwt() ->> 'role' = 'admin' which doesn't work
-- We need to check the users table directly like other policies

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Admins can view all locations" ON employee_locations;

-- Create the correct policy that checks the users table
CREATE POLICY "Admins can view all locations"
ON employee_locations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Also ensure employees can view their own locations
DROP POLICY IF EXISTS "Employees can view their own locations" ON employee_locations;
CREATE POLICY "Employees can view their own locations"
ON employee_locations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Verify the policies are working by testing the function
-- This should now return data for admins
SELECT * FROM get_latest_employee_locations();