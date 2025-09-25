-- Enhanced Permissions Management System
-- This SQL script creates a comprehensive role-based permissions system

-- Create roles table with hierarchical structure
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 0, -- Higher level = more permissions
    is_system_role BOOLEAN DEFAULT FALSE, -- System roles cannot be deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- e.g., 'tasks', 'users', 'analytics', 'location'
    resource TEXT NOT NULL, -- e.g., 'task', 'user', 'report'
    action TEXT NOT NULL, -- e.g., 'create', 'read', 'update', 'delete'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE(role_id, permission_id)
);

-- Create user_roles table (users can have multiple roles)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ, -- Optional role expiration
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, role_id)
);

-- Create permission_groups for easier management
CREATE TABLE IF NOT EXISTS public.permission_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group_permissions junction table
CREATE TABLE IF NOT EXISTS public.group_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID REFERENCES public.permission_groups(id) ON DELETE CASCADE NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(group_id, permission_id)
);

-- Create audit log for permission changes
CREATE TABLE IF NOT EXISTS public.permission_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'grant', 'revoke', 'create_role', 'delete_role', etc.
    resource_type TEXT NOT NULL, -- 'role', 'permission', 'user_role'
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system roles
INSERT INTO public.roles (name, display_name, description, level, is_system_role) VALUES
('super_admin', 'Super Administrator', 'Full system access with all permissions', 100, TRUE),
('admin', 'Administrator', 'Administrative access to most system features', 80, TRUE),
('manager', 'Manager', 'Management level access with team oversight', 60, FALSE),
('supervisor', 'Supervisor', 'Supervisory access with limited administrative functions', 40, FALSE),
('employee', 'Employee', 'Standard employee access', 20, TRUE),
('guest', 'Guest', 'Limited read-only access', 10, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Insert comprehensive permissions
INSERT INTO public.permissions (name, display_name, description, category, resource, action) VALUES
-- User Management Permissions
('users.create', 'Create Users', 'Create new user accounts', 'users', 'user', 'create'),
('users.read', 'View Users', 'View user profiles and information', 'users', 'user', 'read'),
('users.update', 'Update Users', 'Update user profiles and settings', 'users', 'user', 'update'),
('users.delete', 'Delete Users', 'Delete user accounts', 'users', 'user', 'delete'),
('users.manage_roles', 'Manage User Roles', 'Assign and remove roles from users', 'users', 'user_role', 'manage'),

-- Task Management Permissions
('tasks.create', 'Create Tasks', 'Create new tasks', 'tasks', 'task', 'create'),
('tasks.read', 'View Tasks', 'View task details and information', 'tasks', 'task', 'read'),
('tasks.update', 'Update Tasks', 'Update task details and status', 'tasks', 'task', 'update'),
('tasks.delete', 'Delete Tasks', 'Delete tasks', 'tasks', 'task', 'delete'),
('tasks.assign', 'Assign Tasks', 'Assign tasks to employees', 'tasks', 'task', 'assign'),
('tasks.approve', 'Approve Tasks', 'Approve completed tasks', 'tasks', 'task', 'approve'),
('tasks.reject', 'Reject Tasks', 'Reject task submissions', 'tasks', 'task', 'reject'),

-- Analytics and Reporting Permissions
('analytics.view', 'View Analytics', 'Access analytics and reports', 'analytics', 'report', 'read'),
('analytics.export', 'Export Reports', 'Export analytics data', 'analytics', 'report', 'export'),
('analytics.create_reports', 'Create Reports', 'Create custom reports', 'analytics', 'report', 'create'),

-- Location and Tracking Permissions
('location.view', 'View Locations', 'View employee locations', 'location', 'location', 'read'),
('location.track', 'Track Employees', 'Track employee movements', 'location', 'location', 'track'),
('location.manage_geofences', 'Manage Geofences', 'Create and manage geofences', 'location', 'geofence', 'manage'),

-- Communication Permissions
('chat.send', 'Send Messages', 'Send chat messages', 'communication', 'chat', 'create'),
('chat.read', 'Read Messages', 'Read chat messages', 'communication', 'chat', 'read'),
('chat.moderate', 'Moderate Chat', 'Moderate chat conversations', 'communication', 'chat', 'moderate'),

-- System Administration Permissions
('system.settings', 'System Settings', 'Access system settings', 'system', 'settings', 'manage'),
('system.permissions', 'Manage Permissions', 'Manage roles and permissions', 'system', 'permission', 'manage'),
('system.audit', 'View Audit Logs', 'View system audit logs', 'system', 'audit', 'read'),
('system.backup', 'System Backup', 'Create and restore backups', 'system', 'backup', 'manage'),

-- File and Attachment Permissions
('files.upload', 'Upload Files', 'Upload files and attachments', 'files', 'file', 'create'),
('files.download', 'Download Files', 'Download files and attachments', 'files', 'file', 'read'),
('files.delete', 'Delete Files', 'Delete files and attachments', 'files', 'file', 'delete'),

-- Notification Permissions
('notifications.send', 'Send Notifications', 'Send system notifications', 'notifications', 'notification', 'create'),
('notifications.read', 'Read Notifications', 'Read notifications', 'notifications', 'notification', 'read'),
('notifications.manage', 'Manage Notifications', 'Manage notification settings', 'notifications', 'notification', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Create permission groups for easier management
INSERT INTO public.permission_groups (name, display_name, description) VALUES
('user_management', 'User Management', 'All user-related permissions'),
('task_management', 'Task Management', 'All task-related permissions'),
('analytics_reporting', 'Analytics & Reporting', 'All analytics and reporting permissions'),
('location_tracking', 'Location & Tracking', 'All location and tracking permissions'),
('communication', 'Communication', 'All communication-related permissions'),
('system_admin', 'System Administration', 'All system administration permissions'),
('file_management', 'File Management', 'All file and attachment permissions'),
('notifications', 'Notifications', 'All notification-related permissions')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to groups
INSERT INTO public.group_permissions (group_id, permission_id)
SELECT pg.id, p.id
FROM public.permission_groups pg
JOIN public.permissions p ON (
    (pg.name = 'user_management' AND p.category = 'users') OR
    (pg.name = 'task_management' AND p.category = 'tasks') OR
    (pg.name = 'analytics_reporting' AND p.category = 'analytics') OR
    (pg.name = 'location_tracking' AND p.category = 'location') OR
    (pg.name = 'communication' AND p.category = 'communication') OR
    (pg.name = 'system_admin' AND p.category = 'system') OR
    (pg.name = 'file_management' AND p.category = 'files') OR
    (pg.name = 'notifications' AND p.category = 'notifications')
)
ON CONFLICT DO NOTHING;

-- Assign permissions to default roles
-- Super Admin gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin gets most permissions except system-level ones
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'admin' 
AND p.name NOT IN ('system.permissions', 'system.audit', 'system.backup')
ON CONFLICT DO NOTHING;

-- Manager gets management-level permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'manager' 
AND p.name IN (
    'users.read', 'users.update',
    'tasks.create', 'tasks.read', 'tasks.update', 'tasks.assign', 'tasks.approve',
    'analytics.view', 'analytics.export',
    'location.view', 'location.track',
    'chat.send', 'chat.read', 'chat.moderate',
    'files.upload', 'files.download',
    'notifications.send', 'notifications.read'
)
ON CONFLICT DO NOTHING;

-- Supervisor gets supervisory permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'supervisor' 
AND p.name IN (
    'users.read',
    'tasks.read', 'tasks.update', 'tasks.assign',
    'analytics.view',
    'location.view',
    'chat.send', 'chat.read',
    'files.upload', 'files.download',
    'notifications.read'
)
ON CONFLICT DO NOTHING;

-- Employee gets basic permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'employee' 
AND p.name IN (
    'tasks.read', 'tasks.update',
    'location.view',
    'chat.send', 'chat.read',
    'files.upload', 'files.download',
    'notifications.read'
)
ON CONFLICT DO NOTHING;

-- Guest gets read-only permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'guest' 
AND p.name IN (
    'users.read',
    'tasks.read',
    'analytics.view',
    'location.view',
    'chat.read',
    'files.download',
    'notifications.read'
)
ON CONFLICT DO NOTHING;

-- Update existing users to have default roles
INSERT INTO public.user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, NOW()
FROM public.users u, public.roles r
WHERE r.name = CASE 
    WHEN u.role = 'admin' THEN 'admin'
    WHEN u.role = 'employee' THEN 'employee'
    ELSE 'employee'
END
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles
CREATE POLICY "Users can view roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Admins can manage roles" ON public.roles FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);

-- Create RLS policies for permissions
CREATE POLICY "Users can view permissions" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage permissions" ON public.permissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);

-- Create RLS policies for role_permissions
CREATE POLICY "Users can view role permissions" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);

-- Create RLS policies for permission groups
CREATE POLICY "Users can view permission groups" ON public.permission_groups FOR SELECT USING (true);
CREATE POLICY "Admins can manage permission groups" ON public.permission_groups FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);

-- Create RLS policies for group permissions
CREATE POLICY "Users can view group permissions" ON public.group_permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage group permissions" ON public.group_permissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);

-- Create RLS policies for audit log
CREATE POLICY "Admins can view audit logs" ON public.permission_audit_log FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
    )
);
CREATE POLICY "System can insert audit logs" ON public.permission_audit_log FOR INSERT WITH CHECK (true);

-- Create functions for permission checking
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        JOIN public.role_permissions rp ON r.id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id
        AND p.name = permission_name
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id UUID)
RETURNS TABLE(permission_name TEXT, category TEXT, resource TEXT, action TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.name, p.category, p.resource, p.action
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    JOIN public.role_permissions rp ON r.id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_id
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY p.category, p.resource, p.action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(user_id UUID)
RETURNS TABLE(role_name TEXT, role_display_name TEXT, level INTEGER, assigned_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT r.name, r.display_name, r.level, ur.assigned_at
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_id
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY r.level DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for audit logging
CREATE OR REPLACE FUNCTION public.log_permission_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.permission_audit_log (user_id, action, resource_type, resource_id, new_values)
        VALUES (auth.uid(), 'grant', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.permission_audit_log (user_id, action, resource_type, resource_id, old_values, new_values)
        VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.permission_audit_log (user_id, action, resource_type, resource_id, old_values)
        VALUES (auth.uid(), 'revoke', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for audit logging
CREATE TRIGGER audit_role_permissions_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
    FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

CREATE TRIGGER audit_user_roles_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON public.user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON public.permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON public.permissions(action);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_user_id ON public.permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_created_at ON public.permission_audit_log(created_at);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
