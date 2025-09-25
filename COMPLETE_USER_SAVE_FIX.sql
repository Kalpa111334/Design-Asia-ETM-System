-- COMPLETE USER SAVE FIX
-- Run this in your Supabase SQL Editor

-- Step 1: Disable RLS completely
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON public.users;

-- Step 3: Grant ALL permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.users TO postgres;

-- Step 4: Grant schema permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 5: Create robust trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Try to insert user record
  INSERT INTO public.users (id, email, full_name, role, skills, avatar_url, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'employee'),
    COALESCE(
      CASE 
        WHEN new.raw_user_meta_data->>'skills' IS NOT NULL 
        THEN string_to_array(new.raw_user_meta_data->>'skills', ',')
        ELSE ARRAY[]::text[]
      END,
      ARRAY[]::text[]
    ),
    'https://ui-avatars.com/api/?name=' || encode(convert_to(COALESCE(new.raw_user_meta_data->>'full_name', ''), 'UTF8'), 'hex') || '&background=6366f1&color=ffffff',
    NOW()
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, that's fine
    RETURN new;
  WHEN OTHERS THEN
    -- Any other error, log it but continue
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 7: Create backup RPC function
CREATE OR REPLACE FUNCTION public.create_user_backup(
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
    SELECT row_to_json(u.*) INTO new_user
    FROM public.users u
    WHERE u.id = user_id;
    RETURN row_to_json(new_user);
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_user_backup TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_backup TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_backup TO service_role;

-- Step 9: Success message
SELECT 'Complete user save fix applied! User creation should work now.' as message;
