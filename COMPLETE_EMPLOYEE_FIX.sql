-- COMPLETE FIX for Employee Adding Error
-- Copy and paste this entire script into your Supabase SQL Editor and run it

-- Step 1: Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;

-- Step 2: Create comprehensive RLS policies
-- Policy for viewing users
CREATE POLICY "Users can view their own profile and admins can view all"
  ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
    )
  );

-- Policy for updating users
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Policy for admins to insert users
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy for users to insert their own record (for signup)
CREATE POLICY "Users can insert their own record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 3: Create or replace the user sync function
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 5: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.deleted_users TO authenticated;

-- Success message
SELECT 'Employee creation fix applied successfully! You can now add employees without errors.' as message;
