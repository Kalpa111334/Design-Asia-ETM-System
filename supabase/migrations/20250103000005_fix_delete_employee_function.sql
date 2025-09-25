-- Create a robust function to handle employee deletion with duplicate key handling
CREATE OR REPLACE FUNCTION safe_delete_employee(
  p_user_id UUID,
  p_deletion_reason TEXT,
  p_deleted_by UUID
) RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  result JSON;
BEGIN
  -- Get user data
  SELECT * INTO user_record
  FROM public.users
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Insert into deleted_users with ON CONFLICT DO NOTHING
  INSERT INTO public.deleted_users (
    id, email, full_name, role, avatar_url, skills, 
    created_at, deleted_by, deletion_reason, deleted_at
  ) VALUES (
    p_user_id, user_record.email, user_record.full_name, user_record.role,
    user_record.avatar_url, user_record.skills, user_record.created_at,
    p_deleted_by, p_deletion_reason, NOW()
  ) ON CONFLICT (id) DO NOTHING;
  
  -- Delete from users table
  DELETE FROM public.users WHERE id = p_user_id;
  
  RETURN json_build_object('success', true);
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION safe_delete_employee(UUID, TEXT, UUID) TO authenticated;
