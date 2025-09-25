-- User Page Permissions System
-- This creates tables for managing individual user page access permissions

-- Create user_page_permissions table
CREATE TABLE IF NOT EXISTS user_page_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    page_name VARCHAR(100) NOT NULL,
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('view', 'edit', 'none')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, page_name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_page_permissions_user_id ON user_page_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_page_permissions_page_name ON user_page_permissions(page_name);

-- Enable RLS
ALTER TABLE user_page_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON user_page_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON user_page_permissions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON user_page_permissions
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON user_page_permissions
    FOR DELETE USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON user_page_permissions TO authenticated;

-- Create function to get user page permissions
CREATE OR REPLACE FUNCTION get_user_page_permissions(user_uuid UUID)
RETURNS TABLE (
    page_name VARCHAR(100),
    permission_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        upp.page_name,
        upp.permission_type
    FROM user_page_permissions upp
    WHERE upp.user_id = user_uuid
    ORDER BY upp.page_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to set user page permission
CREATE OR REPLACE FUNCTION set_user_page_permission(
    user_uuid UUID,
    page VARCHAR(100),
    permission VARCHAR(20)
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate permission type
    IF permission NOT IN ('view', 'edit', 'none') THEN
        RETURN FALSE;
    END IF;
    
    -- Insert or update permission
    INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
    VALUES (user_uuid, page, permission, auth.uid())
    ON CONFLICT (user_id, page_name)
    DO UPDATE SET 
        permission_type = EXCLUDED.permission_type,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_page_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_page_permission(UUID, VARCHAR, VARCHAR) TO authenticated;

-- Insert default page definitions
-- First, let's create a function to get user role from public.users table
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Try to get role from public.users table first
    SELECT role INTO user_role 
    FROM public.users 
    WHERE id = user_uuid;
    
    -- If not found, default to 'employee'
    IF user_role IS NULL THEN
        user_role := 'employee';
    END IF;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;

-- Insert default page definitions
INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'dashboard',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'dashboard'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'tasks',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'tasks'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'task_pool',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'task_pool'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'employee_tracking',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'employee_tracking'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'location_management',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'location_management'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'meetings',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'meetings'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'reports',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'reports'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'analytics',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'view'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'analytics'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'employee_management',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'none'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'employee_management'
);

INSERT INTO user_page_permissions (user_id, page_name, permission_type, granted_by)
SELECT 
    u.id,
    'permissions_settings',
    CASE 
        WHEN get_user_role(u.id) = 'admin' THEN 'edit'
        ELSE 'none'
    END,
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_page_permissions upp 
    WHERE upp.user_id = u.id AND upp.page_name = 'permissions_settings'
);

SELECT 'User page permissions system created successfully' as status;
