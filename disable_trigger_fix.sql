-- Temporarily disable the trigger to prevent duplicate key errors
-- Run this in your Supabase SQL editor

DROP TRIGGER IF EXISTS on_user_delete ON public.users;
