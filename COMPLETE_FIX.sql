-- COMPLETE FIX for duplicate key error in deleted_users table
-- Copy and paste this entire script into your Supabase SQL Editor and run it

-- Step 1: Drop the problematic trigger
DROP TRIGGER IF EXISTS on_user_delete ON public.users;

-- Step 2: Drop the old function
DROP FUNCTION IF EXISTS public.process_user_deletion();

-- Step 3: Create a new function that handles duplicates gracefully
CREATE OR REPLACE FUNCTION public.process_user_deletion()
RETURNS trigger AS $$
BEGIN
    -- Try to insert, but ignore if it already exists (duplicate key)
    INSERT INTO public.deleted_users (
        id,
        email,
        full_name,
        role,
        avatar_url,
        skills,
        created_at,
        deleted_by,
        deletion_reason
    )
    VALUES (
        old.id,
        old.email,
        old.full_name,
        old.role,
        old.avatar_url,
        old.skills,
        old.created_at,
        auth.uid(),
        COALESCE(current_setting('app.deletion_reason', true), 'No reason provided')
    )
    ON CONFLICT (id) DO NOTHING; -- This prevents duplicate key errors
    
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate the trigger
CREATE TRIGGER on_user_delete
    BEFORE DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.process_user_deletion();

-- Step 5: Create the RPC function for setting deletion reason
CREATE OR REPLACE FUNCTION public.set_deletion_reason(reason text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.deletion_reason', reason, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Clean up any existing duplicates in deleted_users table
DELETE FROM public.deleted_users 
WHERE id IN (
    SELECT id 
    FROM public.deleted_users 
    GROUP BY id 
    HAVING COUNT(*) > 1
);

-- Success message
SELECT 'Fix applied successfully! You can now delete employees without errors.' as message;
