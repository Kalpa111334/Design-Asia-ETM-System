-- Location-Based Tasks Database Setup
-- Run this in your Supabase SQL Editor

-- Create geofences table if it doesn't exist
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    center_latitude DECIMAL(10, 8) NOT NULL,
    center_longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS task_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
    required_latitude DECIMAL(10, 8),
    required_longitude DECIMAL(11, 8),
    required_radius_meters INTEGER DEFAULT 100,
    arrival_required BOOLEAN DEFAULT true,
    departure_required BOOLEAN DEFAULT false,
    location_name TEXT,
    location_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_location_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS task_location_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('check_in', 'check_out', 'arrival', 'departure', 'boundary_violation')),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create location_alerts table if it doesn't exist
CREATE TABLE IF NOT EXISTS location_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('task_completion', 'arrival', 'departure', 'out_of_bounds', 'deadline_reminder', 'emergency')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_read BOOLEAN DEFAULT false,
    is_acknowledged BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Create employee_movement_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS employee_movement_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    altitude DECIMAL(8, 2),
    speed DECIMAL(8, 2),
    heading DECIMAL(5, 2),
    accuracy DECIMAL(8, 2),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    location_source TEXT DEFAULT 'gps' CHECK (location_source IN ('gps', 'network', 'passive')),
    battery_level INTEGER,
    is_mock_location BOOLEAN DEFAULT false
);

-- Add location_based column to tasks table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'location_based') THEN
        ALTER TABLE tasks ADD COLUMN location_based BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_geofences_active ON geofences(is_active);
CREATE INDEX IF NOT EXISTS idx_geofences_location ON geofences(center_latitude, center_longitude);
CREATE INDEX IF NOT EXISTS idx_task_locations_task_id ON task_locations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_locations_geofence_id ON task_locations(geofence_id);
CREATE INDEX IF NOT EXISTS idx_task_locations_coordinates ON task_locations(required_latitude, required_longitude);
CREATE INDEX IF NOT EXISTS idx_task_location_events_task_id ON task_location_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_location_events_user_id ON task_location_events(user_id);
CREATE INDEX IF NOT EXISTS idx_task_location_events_timestamp ON task_location_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_location_alerts_user_id ON location_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_location_alerts_unread ON location_alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_employee_movement_user_id ON employee_movement_history(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_movement_timestamp ON employee_movement_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_tasks_location_based ON tasks(location_based);

-- Enable Row Level Security (RLS)
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_location_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_movement_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for geofences
DROP POLICY IF EXISTS "Users can view active geofences" ON geofences;
CREATE POLICY "Users can view active geofences" ON geofences
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage geofences" ON geofences;
CREATE POLICY "Admins can manage geofences" ON geofences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'manager')
        )
    );

-- RLS Policies for task_locations
DROP POLICY IF EXISTS "Users can view task locations" ON task_locations;
CREATE POLICY "Users can view task locations" ON task_locations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_locations.task_id 
            AND (tasks.assigned_to = auth.uid() OR EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND users.role IN ('admin', 'manager')
            ))
        )
    );

DROP POLICY IF EXISTS "Admins can manage task locations" ON task_locations;
CREATE POLICY "Admins can manage task locations" ON task_locations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'manager')
        )
    );

-- RLS Policies for task_location_events
DROP POLICY IF EXISTS "Users can view their task location events" ON task_location_events;
CREATE POLICY "Users can view their task location events" ON task_location_events
    FOR SELECT USING (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Users can create their task location events" ON task_location_events;
CREATE POLICY "Users can create their task location events" ON task_location_events
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for location_alerts
DROP POLICY IF EXISTS "Users can view their location alerts" ON location_alerts;
CREATE POLICY "Users can view their location alerts" ON location_alerts
    FOR SELECT USING (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Users can update their location alerts" ON location_alerts;
CREATE POLICY "Users can update their location alerts" ON location_alerts
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for employee_movement_history
DROP POLICY IF EXISTS "Users can view their movement history" ON employee_movement_history;
CREATE POLICY "Users can view their movement history" ON employee_movement_history
    FOR SELECT USING (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Users can create their movement history" ON employee_movement_history;
CREATE POLICY "Users can create their movement history" ON employee_movement_history
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create functions for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_geofences_updated_at ON geofences;
CREATE TRIGGER update_geofences_updated_at
    BEFORE UPDATE ON geofences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to check geofence boundaries
CREATE OR REPLACE FUNCTION check_geofence_boundary(
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    geofence_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    geofence_record RECORD;
    distance DECIMAL;
BEGIN
    SELECT center_latitude, center_longitude, radius_meters 
    INTO geofence_record
    FROM geofences 
    WHERE id = geofence_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate distance using Haversine formula (simplified)
    distance := 6371000 * acos(
        cos(radians(lat)) * cos(radians(geofence_record.center_latitude)) * 
        cos(radians(geofence_record.center_longitude) - radians(lng)) + 
        sin(radians(lat)) * sin(radians(geofence_record.center_latitude))
    );
    
    RETURN distance <= geofence_record.radius_meters;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert sample geofences (optional)
INSERT INTO geofences (name, description, center_latitude, center_longitude, radius_meters, is_active)
VALUES 
    ('Colombo Office', 'Main office location in Colombo', 6.9271, 79.8612, 200, true),
    ('Kandy Branch', 'Branch office in Kandy', 7.2906, 80.6337, 150, true),
    ('Galle Site', 'Project site in Galle', 6.0535, 80.2210, 300, true)
ON CONFLICT DO NOTHING;

-- Create a view for easy task location queries
CREATE OR REPLACE VIEW task_locations_view AS
SELECT 
    tl.*,
    t.title as task_title,
    t.status as task_status,
    t.priority as task_priority,
    t.assigned_to,
    u.full_name as assigned_to_name,
    g.name as geofence_name,
    g.description as geofence_description
FROM task_locations tl
LEFT JOIN tasks t ON tl.task_id = t.id
LEFT JOIN users u ON t.assigned_to = u.id
LEFT JOIN geofences g ON tl.geofence_id = g.id;

COMMIT;

-- Success message
SELECT 'Location-based tasks database setup completed successfully!' as message;