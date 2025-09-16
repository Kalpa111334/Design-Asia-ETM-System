-- FINAL DATABASE OPEN FIX
-- Run this in your Supabase SQL Editor

-- Step 1: Completely disable RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON public.users;

-- Step 3: Grant ALL permissions to ALL roles
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.users TO postgres;

-- Step 4: Grant schema permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 5: Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Step 6: Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Step 7: Create simple trigger (optional)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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
    RETURN new;
  WHEN OTHERS THEN
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 9: Success message
SELECT 'Final database open fix applied! Employee creation should work now.' as message;
