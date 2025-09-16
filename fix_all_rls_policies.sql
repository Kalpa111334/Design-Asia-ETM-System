-- Comprehensive fix for all RLS policies to prevent infinite recursion
-- Run this in your Supabase SQL Editor

-- Step 1: Create helper functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user exists in auth.users and has admin role in metadata
    RETURN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Fix users table policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.users;

-- Create new non-recursive policies for users
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    TO authenticated
    USING (is_admin());

CREATE POLICY "Admins can manage all users"
    ON public.users FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Allow authenticated users to insert"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (true);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 3: Fix geofences table policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geofences' AND table_schema = 'public') THEN
        ALTER TABLE public.geofences DISABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Admins can manage geofences" ON public.geofences;
        DROP POLICY IF EXISTS "Employees can view active geofences" ON public.geofences;
        DROP POLICY IF EXISTS "Allow authenticated users to insert geofences" ON public.geofences;
        
        -- Create new policies
        CREATE POLICY "Admins can manage geofences"
            ON public.geofences FOR ALL
            TO authenticated
            USING (is_admin())
            WITH CHECK (is_admin());

        CREATE POLICY "Employees can view active geofences"
            ON public.geofences FOR SELECT
            TO authenticated
            USING (is_active = true);

        CREATE POLICY "Allow authenticated users to insert geofences"
            ON public.geofences FOR INSERT
            TO authenticated
            WITH CHECK (true);

        ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Step 4: Fix tasks table policies (if needed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks' AND table_schema = 'public') THEN
        -- Check if tasks table has RLS enabled
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tasks' AND relrowsecurity = true) THEN
            ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
            
            -- Drop existing policies
            DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
            DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
            DROP POLICY IF EXISTS "Enable read access for all users" ON public.tasks;
            DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.tasks;
            DROP POLICY IF EXISTS "Enable update for users based on email" ON public.tasks;
            
            -- Create new policies
            CREATE POLICY "Users can view assigned tasks"
                ON public.tasks FOR SELECT
                TO authenticated
                USING (assigned_to = auth.uid());

            CREATE POLICY "Admins can manage all tasks"
                ON public.tasks FOR ALL
                TO authenticated
                USING (is_admin())
                WITH CHECK (is_admin());

            CREATE POLICY "Allow authenticated users to insert tasks"
                ON public.tasks FOR INSERT
                TO authenticated
                WITH CHECK (true);

            ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
        END IF;
    END IF;
END $$;

-- Step 5: Verify all policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Step 6: Test the is_admin function
SELECT 
    auth.uid() as current_user_id,
    is_admin() as is_current_user_admin;
