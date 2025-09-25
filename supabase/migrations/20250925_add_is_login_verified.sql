alter table public.users add column if not exists is_login_verified boolean not null default false;

