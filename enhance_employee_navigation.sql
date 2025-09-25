-- Enhanced Employee Navigation Tracking System
-- This script improves the employee location tracking with better navigation features

-- First, let's fix the database schema inconsistencies
-- Drop existing policies and functions that might conflict
DROP POLICY IF EXISTS "Admins can view all locations" ON employee_locations;
DROP POLICY IF EXISTS "Employees can insert their own location" ON employee_locations;
DROP POLICY IF EXISTS "Employees can view their own locations" ON employee_locations;
DROP FUNCTION IF EXISTS get_latest_employee_locations();

-- Disable RLS temporarily to fix schema
ALTER TABLE employee_locations DISABLE ROW LEVEL SECURITY;

-- Add missing columns for enhanced navigation tracking
ALTER TABLE employee_locations 
ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS altitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS movement_type TEXT CHECK (movement_type IN ('walking', 'driving', 'stationary', 'unknown'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_locations_speed ON employee_locations(speed);
CREATE INDEX IF NOT EXISTS idx_employee_locations_heading ON employee_locations(heading);
CREATE INDEX IF NOT EXISTS idx_employee_locations_movement_type ON employee_locations(movement_type);
CREATE INDEX IF NOT EXISTS idx_employee_locations_user_timestamp ON employee_locations(user_id, timestamp DESC);

-- Re-enable RLS
ALTER TABLE employee_locations ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies
CREATE POLICY "Allow all operations for authenticated users" ON employee_locations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON employee_locations TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create enhanced function to get latest employee locations with navigation data
CREATE OR REPLACE FUNCTION get_latest_employee_locations()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ,
    battery_level INTEGER,
    connection_status TEXT,
    location_accuracy DOUBLE PRECISION,
    task_id UUID,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    address TEXT,
    movement_type TEXT,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT,
    task_title TEXT,
    task_status TEXT,
    task_due_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH latest_locations AS (
        SELECT DISTINCT ON (el.user_id)
            el.id,
            el.user_id,
            el.latitude,
            el.longitude,
            el.timestamp,
            el.battery_level,
            el.connection_status,
            el.location_accuracy,
            el.task_id,
            el.speed,
            el.heading,
            el.altitude,
            el.address,
            el.movement_type
        FROM employee_locations el
        WHERE el.timestamp > NOW() - INTERVAL '24 hours'
        ORDER BY el.user_id, el.timestamp DESC
    )
    SELECT
        l.id,
        l.user_id,
        l.latitude,
        l.longitude,
        l.timestamp as recorded_at,
        l.battery_level,
        l.connection_status,
        l.location_accuracy,
        l.task_id,
        l.speed,
        l.heading,
        l.altitude,
        l.address,
        l.movement_type,
        u.full_name,
        u.avatar_url,
        u.email,
        t.title as task_title,
        t.status as task_status,
        t.due_date as task_due_date
    FROM latest_locations l
    LEFT JOIN users u ON u.id = l.user_id
    LEFT JOIN tasks t ON t.id = l.task_id
    ORDER BY l.timestamp DESC;
END;
$$;

-- Create function to get employee movement history for navigation tracking
CREATE OR REPLACE FUNCTION get_employee_movement_history(
    p_user_id UUID,
    p_hours INTEGER DEFAULT 8
)
RETURNS TABLE (
    id UUID,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    movement_type TEXT,
    address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        el.id,
        el.latitude,
        el.longitude,
        el.timestamp as recorded_at,
        el.speed,
        el.heading,
        el.movement_type,
        el.address
    FROM employee_locations el
    WHERE el.user_id = p_user_id
    AND el.timestamp > NOW() - INTERVAL '1 hour' * p_hours
    ORDER BY el.timestamp ASC;
END;
$$;

-- Create function to calculate movement statistics
CREATE OR REPLACE FUNCTION calculate_movement_stats(
    p_user_id UUID,
    p_hours INTEGER DEFAULT 8
)
RETURNS TABLE (
    total_distance_km DOUBLE PRECISION,
    average_speed_kmh DOUBLE PRECISION,
    max_speed_kmh DOUBLE PRECISION,
    active_time_minutes INTEGER,
    idle_time_minutes INTEGER,
    movement_points INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_distance DOUBLE PRECISION := 0;
    avg_speed DOUBLE PRECISION := 0;
    max_speed DOUBLE PRECISION := 0;
    active_time INTEGER := 0;
    idle_time INTEGER := 0;
    point_count INTEGER := 0;
    prev_lat DOUBLE PRECISION;
    prev_lng DOUBLE PRECISION;
    prev_time TIMESTAMPTZ;
    distance DOUBLE PRECISION;
    time_diff INTEGER;
    speed_kmh DOUBLE PRECISION;
    rec RECORD;
BEGIN
    -- Get movement history
    FOR rec IN 
        SELECT latitude, longitude, timestamp, speed
        FROM employee_locations 
        WHERE user_id = p_user_id 
        AND timestamp > NOW() - INTERVAL '1 hour' * p_hours
        ORDER BY timestamp ASC
    LOOP
        point_count := point_count + 1;
        
        IF prev_lat IS NOT NULL AND prev_lng IS NOT NULL THEN
            -- Calculate distance using Haversine formula
            distance := (
                6371 * acos(
                    cos(radians(prev_lat)) * cos(radians(rec.latitude)) *
                    cos(radians(rec.longitude) - radians(prev_lng)) +
                    sin(radians(prev_lat)) * sin(radians(rec.latitude))
                )
            );
            
            total_distance := total_distance + distance;
            
            -- Calculate time difference in minutes
            time_diff := EXTRACT(EPOCH FROM (rec.timestamp - prev_time)) / 60;
            
            -- Calculate speed in km/h
            IF time_diff > 0 THEN
                speed_kmh := (distance / time_diff) * 60;
                
                IF speed_kmh > max_speed THEN
                    max_speed := speed_kmh;
                END IF;
                
                -- Determine if moving or idle (threshold: 5 km/h)
                IF speed_kmh > 5 THEN
                    active_time := active_time + time_diff;
                ELSE
                    idle_time := idle_time + time_diff;
                END IF;
            END IF;
        END IF;
        
        prev_lat := rec.latitude;
        prev_lng := rec.longitude;
        prev_time := rec.timestamp;
    END LOOP;
    
    -- Calculate average speed
    IF active_time > 0 THEN
        avg_speed := (total_distance / active_time) * 60;
    END IF;
    
    RETURN QUERY SELECT 
        ROUND(total_distance::NUMERIC, 2),
        ROUND(avg_speed::NUMERIC, 2),
        ROUND(max_speed::NUMERIC, 2),
        active_time::INTEGER,
        idle_time::INTEGER,
        point_count::INTEGER;
END;
$$;

-- Create function to get real-time navigation data
CREATE OR REPLACE FUNCTION get_realtime_navigation_data()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    current_speed DOUBLE PRECISION,
    current_heading DOUBLE PRECISION,
    movement_type TEXT,
    last_update TIMESTAMPTZ,
    battery_level INTEGER,
    connection_status TEXT,
    task_title TEXT,
    estimated_arrival TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH latest_positions AS (
        SELECT DISTINCT ON (el.user_id)
            el.user_id,
            el.latitude,
            el.longitude,
            el.speed,
            el.heading,
            el.movement_type,
            el.timestamp,
            el.battery_level,
            el.connection_status,
            el.task_id
        FROM employee_locations el
        WHERE el.timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY el.user_id, el.timestamp DESC
    )
    SELECT
        lp.user_id,
        u.full_name,
        lp.latitude as current_lat,
        lp.longitude as current_lng,
        lp.speed as current_speed,
        lp.heading as current_heading,
        lp.movement_type,
        lp.timestamp as last_update,
        lp.battery_level,
        lp.connection_status,
        t.title as task_title,
        CASE 
            WHEN lp.speed > 0 AND t.due_date IS NOT NULL THEN
                lp.timestamp + INTERVAL '1 second' * (
                    ST_Distance(
                        ST_Point(lp.longitude, lp.latitude)::geography,
                        ST_Point(t.location_longitude, t.location_latitude)::geography
                    ) / (lp.speed * 1000 / 3600)
                )
            ELSE NULL
        END as estimated_arrival
    FROM latest_positions lp
    LEFT JOIN users u ON u.id = lp.user_id
    LEFT JOIN tasks t ON t.id = lp.task_id
    WHERE lp.connection_status = 'online'
    ORDER BY lp.timestamp DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_latest_employee_locations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_movement_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_movement_stats(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_realtime_navigation_data() TO authenticated;

-- Create a trigger to automatically determine movement type based on speed
CREATE OR REPLACE FUNCTION determine_movement_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Determine movement type based on speed (km/h)
    IF NEW.speed IS NULL OR NEW.speed < 1 THEN
        NEW.movement_type := 'stationary';
    ELSIF NEW.speed < 10 THEN
        NEW.movement_type := 'walking';
    ELSIF NEW.speed < 80 THEN
        NEW.movement_type := 'driving';
    ELSE
        NEW.movement_type := 'unknown';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS determine_movement_type_trigger ON employee_locations;
CREATE TRIGGER determine_movement_type_trigger
    BEFORE INSERT OR UPDATE ON employee_locations
    FOR EACH ROW
    EXECUTE FUNCTION determine_movement_type();

-- Test the setup
DO $$
BEGIN
    RAISE NOTICE 'Enhanced employee navigation tracking system setup completed successfully';
    RAISE NOTICE 'Available functions:';
    RAISE NOTICE '- get_latest_employee_locations()';
    RAISE NOTICE '- get_employee_movement_history(user_id, hours)';
    RAISE NOTICE '- calculate_movement_stats(user_id, hours)';
    RAISE NOTICE '- get_realtime_navigation_data()';
END $$;
