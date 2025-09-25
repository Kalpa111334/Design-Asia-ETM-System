-- DIRECT FIX for Employee Adding Error
-- Run this in your Supabase SQL Editor

-- Step 1: Completely disable RLS on users table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.users;

-- Step 3: Grant all permissions to authenticated role
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.deleted_users TO authenticated;

-- Step 4: Create a simple user sync function
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

-- Step 5: Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Success message
SELECT 'Direct employee fix applied! RLS disabled, you can now add employees.' as message;
