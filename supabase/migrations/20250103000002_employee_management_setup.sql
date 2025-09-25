-- Employee Management Setup Migration
-- This migration ensures all necessary tables and permissions are in place for employee CRUD operations

-- Ensure users table exists with all required columns
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    skills TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at column if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure deleted_users table exists
CREATE TABLE IF NOT EXISTS public.deleted_users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL,
    skills TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deletion_reason TEXT NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

-- Create or replace the is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
        AND public.users.role = 'admin'
    );
$$;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage deleted users" ON public.deleted_users;

-- Create comprehensive RLS policies for users table
CREATE POLICY "Admins can manage all users"
    ON public.users FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Create RLS policies for deleted_users table
CREATE POLICY "Admins can manage deleted users"
    ON public.deleted_users FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_deleted_users_deleted_by ON public.deleted_users(deleted_by);
CREATE INDEX IF NOT EXISTS idx_deleted_users_deleted_at ON public.deleted_users(deleted_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.deleted_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Create a function to sync user data from auth to public.users
CREATE OR REPLACE FUNCTION public.sync_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role, avatar_url, skills)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE((NEW.raw_user_meta_data->>'skills')::text[], '{}')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        avatar_url = EXCLUDED.avatar_url,
        skills = EXCLUDED.skills,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync users from auth.users to public.users
DROP TRIGGER IF EXISTS sync_user_from_auth_trigger ON auth.users;
CREATE TRIGGER sync_user_from_auth_trigger
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_from_auth();

-- Create a function to handle user deletion
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Move user to deleted_users table before deletion
    INSERT INTO public.deleted_users (
        id, email, full_name, avatar_url, role, skills, created_at, deleted_by, deletion_reason
    )
    SELECT 
        OLD.id, OLD.email, OLD.full_name, OLD.avatar_url, OLD.role, OLD.skills, OLD.created_at,
        auth.uid(), 'User deleted from auth system'
    WHERE NOT EXISTS (
        SELECT 1 FROM public.deleted_users WHERE id = OLD.id
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle user deletion
DROP TRIGGER IF EXISTS handle_user_deletion_trigger ON public.users;
CREATE TRIGGER handle_user_deletion_trigger
    BEFORE DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_deletion();

-- Ensure all existing auth users are synced to public.users
INSERT INTO public.users (id, email, full_name, role, avatar_url, skills)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'role', 'employee'),
    au.raw_user_meta_data->>'avatar_url',
    COALESCE((au.raw_user_meta_data->>'skills')::text[], '{}')
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    avatar_url = EXCLUDED.avatar_url,
    skills = EXCLUDED.skills,
    updated_at = NOW();

-- Add comments for documentation
COMMENT ON TABLE public.users IS 'Active users in the system';
COMMENT ON TABLE public.deleted_users IS 'Soft-deleted users for audit trail';
COMMENT ON FUNCTION public.is_admin() IS 'Check if current user is an admin';
COMMENT ON FUNCTION public.sync_user_from_auth() IS 'Sync user data from auth.users to public.users';
COMMENT ON FUNCTION public.handle_user_deletion() IS 'Handle user deletion by moving to deleted_users table';
