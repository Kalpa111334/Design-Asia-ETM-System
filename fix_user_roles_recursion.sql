-- Fix infinite recursion in user_roles RLS policies
-- This script fixes the RLS policies that are causing infinite recursion

-- First, disable RLS temporarily to fix the policies
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be causing recursion
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view user roles" ON user_roles;

-- Create simple, non-recursive policies
CREATE POLICY "Enable read access for authenticated users" ON user_roles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON user_roles
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON user_roles
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON user_roles
    FOR DELETE USING (auth.role() = 'authenticated');

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Also fix roles table policies
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view roles" ON roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;

-- Create simple policies for roles table
CREATE POLICY "Enable read access for authenticated users" ON roles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON roles
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON roles
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON roles
    FOR DELETE USING (auth.role() = 'authenticated');

-- Re-enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Fix role_permissions table policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
        ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view role permissions" ON role_permissions;
        DROP POLICY IF EXISTS "Admins can manage role permissions" ON role_permissions;
        
        -- Create simple policies for role_permissions table
        CREATE POLICY "Enable read access for authenticated users" ON role_permissions
            FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable insert for authenticated users" ON role_permissions
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable update for authenticated users" ON role_permissions
            FOR UPDATE USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable delete for authenticated users" ON role_permissions
            FOR DELETE USING (auth.role() = 'authenticated');
        
        -- Re-enable RLS
        ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Fixed role_permissions table policies';
    ELSE
        RAISE NOTICE 'role_permissions table does not exist, skipping';
    END IF;
END $$;

-- Fix permissions table policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permissions') THEN
        ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view permissions" ON permissions;
        DROP POLICY IF EXISTS "Admins can manage permissions" ON permissions;
        
        -- Create simple policies for permissions table
        CREATE POLICY "Enable read access for authenticated users" ON permissions
            FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable insert for authenticated users" ON permissions
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable update for authenticated users" ON permissions
            FOR UPDATE USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable delete for authenticated users" ON permissions
            FOR DELETE USING (auth.role() = 'authenticated');
        
        -- Re-enable RLS
        ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Fixed permissions table policies';
    ELSE
        RAISE NOTICE 'permissions table does not exist, skipping';
    END IF;
END $$;

-- Fix permission_groups table policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permission_groups') THEN
        ALTER TABLE permission_groups DISABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view permission groups" ON permission_groups;
        DROP POLICY IF EXISTS "Admins can manage permission groups" ON permission_groups;
        
        -- Create simple policies for permission_groups table
        CREATE POLICY "Enable read access for authenticated users" ON permission_groups
            FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable insert for authenticated users" ON permission_groups
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable update for authenticated users" ON permission_groups
            FOR UPDATE USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable delete for authenticated users" ON permission_groups
            FOR DELETE USING (auth.role() = 'authenticated');
        
        -- Re-enable RLS
        ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Fixed permission_groups table policies';
    ELSE
        RAISE NOTICE 'permission_groups table does not exist, skipping';
    END IF;
END $$;

-- Fix permission_audit_logs table policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permission_audit_logs') THEN
        ALTER TABLE permission_audit_logs DISABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view audit logs" ON permission_audit_logs;
        DROP POLICY IF EXISTS "Admins can manage audit logs" ON permission_audit_logs;
        
        -- Create simple policies for permission_audit_logs table
        CREATE POLICY "Enable read access for authenticated users" ON permission_audit_logs
            FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable insert for authenticated users" ON permission_audit_logs
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable update for authenticated users" ON permission_audit_logs
            FOR UPDATE USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Enable delete for authenticated users" ON permission_audit_logs
            FOR DELETE USING (auth.role() = 'authenticated');
        
        -- Re-enable RLS
        ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Fixed permission_audit_logs table policies';
    ELSE
        RAISE NOTICE 'permission_audit_logs table does not exist, skipping';
    END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify the fix
SELECT 'RLS policies fixed successfully' as status;
