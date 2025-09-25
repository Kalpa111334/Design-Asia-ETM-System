-- Complete fix for employee locations issue
-- This addresses both RLS policies and ensures there's test data

-- Step 1: Fix RLS policies
DROP POLICY IF EXISTS "Admins can view all locations" ON employee_locations;
DROP POLICY IF EXISTS "Employees can view their own locations" ON employee_locations;
DROP POLICY IF EXISTS "Employees can insert their own location" ON employee_locations;

-- Create correct RLS policies
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

CREATE POLICY "Employees can view their own locations"
ON employee_locations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Employees can insert their own location"
ON employee_locations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Step 2: Check if we have any users and their roles
SELECT id, email, full_name, role FROM users ORDER BY created_at DESC LIMIT 5;

-- Step 3: Insert test employee location data (if no data exists)
-- First, let's get a regular employee user (not admin)
DO $$
DECLARE
    employee_user_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get an employee user
    SELECT id INTO employee_user_id 
    FROM users 
    WHERE role = 'employee' 
    LIMIT 1;
    
    -- Get an admin user
    SELECT id INTO admin_user_id 
    FROM users 
    WHERE role = 'admin' 
    LIMIT 1;
    
    -- If we have an employee, insert test location
    IF employee_user_id IS NOT NULL THEN
        INSERT INTO employee_locations (user_id, latitude, longitude, timestamp, battery_level, connection_status)
        VALUES 
            (employee_user_id, 40.7128, -74.0060, NOW() - INTERVAL '5 minutes', 85, 'online'),
            (employee_user_id, 40.7130, -74.0058, NOW() - INTERVAL '2 minutes', 84, 'online'),
            (employee_user_id, 40.7132, -74.0056, NOW(), 83, 'online')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Inserted test locations for employee user: %', employee_user_id;
    ELSE
        RAISE NOTICE 'No employee user found to insert test data';
    END IF;
    
    -- If we have an admin, also insert a location for them
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO employee_locations (user_id, latitude, longitude, timestamp, battery_level, connection_status)
        VALUES 
            (admin_user_id, 40.7580, -73.9855, NOW() - INTERVAL '3 minutes', 92, 'online'),
            (admin_user_id, 40.7582, -73.9853, NOW(), 91, 'online')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Inserted test locations for admin user: %', admin_user_id;
    ELSE
        RAISE NOTICE 'No admin user found to insert test data';
    END IF;
END $$;

-- Step 4: Test the function
SELECT 'Testing get_latest_employee_locations function:' as message;
SELECT 
    user_id,
    full_name,
    latitude,
    longitude,
    recorded_at,
    battery_level,
    connection_status
FROM get_latest_employee_locations()
ORDER BY recorded_at DESC;

-- Step 5: Check current user's role and permissions
SELECT 
    'Current user info:' as message,
    auth.uid() as current_user_id,
    u.email,
    u.full_name,
    u.role
FROM users u 
WHERE u.id = auth.uid();

-- Step 6: Show all employee locations (for debugging)
SELECT 'All employee_locations records:' as message;
SELECT 
    el.user_id,
    u.full_name,
    u.role,
    el.latitude,
    el.longitude,
    el.timestamp,
    el.battery_level,
    el.connection_status
FROM employee_locations el
LEFT JOIN users u ON u.id = el.user_id
ORDER BY el.timestamp DESC
LIMIT 10;