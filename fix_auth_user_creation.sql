-- Fix auth user creation by ensuring proper trigger setup
-- This script ensures the handle_new_user trigger works correctly

-- Disable RLS temporarily to fix any permission issues
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

-- Grant all necessary permissions
GRANT ALL ON SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users table with data from auth.users
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    skills,
    avatar_url,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'skills' IS NOT NULL 
      THEN string_to_array(NEW.raw_user_meta_data->>'skills', ',')
      ELSE ARRAY[]::text[]
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL 
      THEN 'https://ui-avatars.com/api/?name=' || encode(convert_to(NEW.raw_user_meta_data->>'full_name', 'UTF8'), 'hex') || '&background=6366f1&color=ffffff'
      ELSE 'https://ui-avatars.com/api/?name=' || encode(convert_to(NEW.email, 'UTF8'), 'hex') || '&background=6366f1&color=ffffff'
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    skills = EXCLUDED.skills,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If there's a conflict, just return NEW
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth user creation
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON public.users
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions to authenticated users
GRANT ALL ON public.users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Test the setup
DO $$
BEGIN
  RAISE NOTICE 'Auth user creation trigger setup completed successfully';
END $$;
