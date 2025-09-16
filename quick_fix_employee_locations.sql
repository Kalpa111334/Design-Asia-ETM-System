-- Quick fix for "No employee locations found" error

-- 1. Fix the RLS policy (main issue)
DROP POLICY IF EXISTS "Admins can view all locations" ON employee_locations;

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

-- 2. Add test data if none exists
INSERT INTO employee_locations (user_id, latitude, longitude, timestamp, battery_level, connection_status)
SELECT 
    u.id,
    40.7128 + (RANDOM() * 0.01), -- Random location around NYC
    -74.0060 + (RANDOM() * 0.01),
    NOW() - (RANDOM() * INTERVAL '1 hour'),
    80 + (RANDOM() * 20)::INTEGER,
    'online'
FROM users u
WHERE u.role IN ('employee', 'admin')
AND NOT EXISTS (
    SELECT 1 FROM employee_locations el 
    WHERE el.user_id = u.id 
    AND el.timestamp > NOW() - INTERVAL '24 hours'
)
LIMIT 5;

-- 3. Test the function
SELECT * FROM get_latest_employee_locations();