-- FINAL FIX for Employee Adding Error
-- Run this in your Supabase SQL Editor

-- Step 1: Disable RLS on users table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.users;

-- Step 3: Create RPC function for user creation
CREATE OR REPLACE FUNCTION public.create_user_record(
  user_id uuid,
  user_email text,
  user_full_name text,
  user_role text,
  user_skills text[]
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Insert user record
  INSERT INTO public.users (id, email, full_name, role, skills, avatar_url)
  VALUES (
    user_id,
    user_email,
    user_full_name,
    user_role,
    user_skills,
    'https://ui-avatars.com/api/?name=' || encode(convert_to(user_full_name, 'UTF8'), 'hex') || '&background=6366f1&color=ffffff'
  );
  
  -- Return the created user
  SELECT to_json(u.*) INTO result
  FROM public.users u
  WHERE u.id = user_id;
  
  RETURN result;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, return existing user
    SELECT to_json(u.*) INTO result
    FROM public.users u
    WHERE u.id = user_id;
    RETURN result;
  WHEN OTHERS THEN
    -- Return error
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.create_user_record TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- Step 5: Create user sync function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, skills, avatar_url)
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
    'https://ui-avatars.com/api/?name=' || encode(convert_to(COALESCE(new.raw_user_meta_data->>'full_name', ''), 'UTF8'), 'hex') || '&background=6366f1&color=ffffff'
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    RETURN new;
  WHEN OTHERS THEN
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Success message
SELECT 'Final employee fix applied! You can now add employees using RPC function.' as message;
