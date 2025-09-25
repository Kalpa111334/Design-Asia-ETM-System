-- Fix users table foreign key constraint
-- This migration removes the foreign key constraint that's causing the error

-- Drop the foreign key constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Add a new column to track if the user has auth access
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_auth_access BOOLEAN DEFAULT FALSE;

-- Update existing users to mark them as having auth access
UPDATE public.users SET has_auth_access = TRUE WHERE id IN (
  SELECT id FROM auth.users
);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_has_auth_access ON public.users(has_auth_access);

-- Update the sync function to handle the new structure
CREATE OR REPLACE FUNCTION public.sync_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- Update existing user or insert new one
    INSERT INTO public.users (id, email, full_name, role, avatar_url, skills, has_auth_access)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE((NEW.raw_user_meta_data->>'skills')::text[], '{}'),
        TRUE
    )
    ON CONFLICT (email) DO UPDATE SET
        id = NEW.id,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        role = COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
        avatar_url = NEW.raw_user_meta_data->>'avatar_url',
        skills = COALESCE((NEW.raw_user_meta_data->>'skills')::text[], '{}'),
        has_auth_access = TRUE,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON COLUMN public.users.has_auth_access IS 'Indicates if the user has authentication access';
