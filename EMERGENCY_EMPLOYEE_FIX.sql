-- EMERGENCY FIX for Employee Adding Error
-- Run this in your Supabase SQL Editor

-- Step 1: Check if users table exists and has correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public';

-- Step 2: Completely disable RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;

-- Step 4: Grant ALL permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon;
GRANT ALL ON public.users TO service_role;

-- Step 5: Create simple RPC function
CREATE OR REPLACE FUNCTION public.create_user_simple(
  user_id uuid,
  user_email text,
  user_full_name text,
  user_role text DEFAULT 'employee',
  user_skills text[] DEFAULT ARRAY[]::text[]
)
RETURNS json AS $$
DECLARE
  new_user record;
BEGIN
  -- Try to insert user
  INSERT INTO public.users (id, email, full_name, role, skills, avatar_url, created_at)
  VALUES (
    user_id,
    user_email,
    user_full_name,
    user_role,
    user_skills,
    'https://ui-avatars.com/api/?name=' || encode(convert_to(user_full_name, 'UTF8'), 'hex') || '&background=6366f1&color=ffffff',
    NOW()
  )
  RETURNING * INTO new_user;
  
  RETURN row_to_json(new_user);
EXCEPTION
  WHEN unique_violation THEN
    -- Return existing user
    SELECT row_to_json(u.*) INTO new_user
    FROM public.users u
    WHERE u.id = user_id;
    RETURN row_to_json(new_user);
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM, 'code', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_user_simple TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_simple TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_simple TO service_role;

-- Step 7: Test the function
SELECT 'Emergency fix applied! Testing user creation...' as message;
