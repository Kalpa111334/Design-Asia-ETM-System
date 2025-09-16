-- Fix RLS policy for employee_locations to match other policies
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
CREATE POLICY "Employees can view their own locations"
ON employee_locations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);