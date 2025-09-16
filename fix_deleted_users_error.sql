-- Quick fix for deleted_users duplicate key error
-- Run this SQL directly in your Supabase SQL editor

-- Drop the existing trigger and function
drop trigger if exists on_user_delete on public.users;
drop function if exists public.process_user_deletion();

-- Create updated function that handles deletion reasons via session variable
create or replace function public.process_user_deletion()
returns trigger as $$
declare
    deletion_reason_text text;
begin
    -- Get deletion reason from session variable, default to 'No reason provided'
    deletion_reason_text := coalesce(
        current_setting('app.deletion_reason', true), 
        'No reason provided'
    );
    
    -- Insert the user data into deleted_users
    insert into public.deleted_users (
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
    values (
        old.id,
        old.email,
        old.full_name,
        old.role,
        old.avatar_url,
        old.skills,
        old.created_at,
        auth.uid(),
        deletion_reason_text
    );
    return old;
end;
$$ language plpgsql security definer;

-- Create trigger to handle user deletion
create trigger on_user_delete
    before delete on public.users
    for each row
    execute function public.process_user_deletion();

-- Create RPC function to set deletion reason in session variable
create or replace function public.set_deletion_reason(reason text)
returns void as $$
begin
    perform set_config('app.deletion_reason', reason, true);
end;
$$ language plpgsql security definer;
