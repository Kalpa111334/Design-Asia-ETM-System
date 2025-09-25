-- Create table for short-lived login PIN approvals
create table if not exists public.login_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code text not null,
  status text not null check (status in ('pending','approved','rejected','expired')) default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz
);

-- Indexes for quick lookups
create index if not exists idx_login_pins_user_id on public.login_pins(user_id);
create index if not exists idx_login_pins_status on public.login_pins(status);
create index if not exists idx_login_pins_expires_at on public.login_pins(expires_at);

-- Row Level Security
alter table public.login_pins enable row level security;

-- Policies: admin full access; user can read own pending/approved; insert own request
create policy login_pins_admin_all on public.login_pins for all to authenticated using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
) with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

create policy login_pins_user_read on public.login_pins for select to authenticated using (
  user_id = auth.uid()
);

create policy login_pins_user_insert on public.login_pins for insert to authenticated with check (
  user_id = auth.uid()
);

-- Helper function to expire old pins (optional)
create or replace function public.expire_old_login_pins() returns void as $$
begin
  update public.login_pins
  set status = 'expired'
  where status = 'pending' and expires_at < now();
end;
$$ language plpgsql;


