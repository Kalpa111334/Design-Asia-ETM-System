-- Fix deleted_users duplicate key constraint issue
-- This migration creates a function to safely handle user deletion

-- Create a function to safely delete a user
CREATE OR REPLACE FUNCTION public.safe_delete_user(
    user_id UUID,
    deletion_reason TEXT,
    deleted_by_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_to_delete RECORD;
BEGIN
    -- Get user information
    SELECT * INTO user_to_delete FROM public.users WHERE id = user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Insert into deleted_users with ON CONFLICT DO NOTHING
    INSERT INTO public.deleted_users (
        id, email, full_name, role, avatar_url, skills, created_at, 
        deleted_by, deletion_reason, deleted_at
    ) VALUES (
        user_id,
        user_to_delete.email,
        user_to_delete.full_name,
        user_to_delete.role,
        user_to_delete.avatar_url,
        user_to_delete.skills,
        user_to_delete.created_at,
        deleted_by_user_id,
        deletion_reason,
        NOW()
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Delete from users table
    DELETE FROM public.users WHERE id = user_id;
    
    RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.safe_delete_user(UUID, TEXT, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.safe_delete_user(UUID, TEXT, UUID) IS 'Safely delete a user by moving to deleted_users table with conflict handling';
