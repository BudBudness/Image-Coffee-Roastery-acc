-- Image Coffee Roastery accommodation system
-- Apply to the intended Supabase project after review.
create extension if not exists btree_gist;

create type public.room_status as enum ('available', 'occupied', 'maintenance');
create type public.reservation_status as enum ('enquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
create type public.payment_method as enum ('cash', 'mobile_money', 'bank_transfer', 'card', 'other');
create type public.staff_role as enum ('manager', 'reception', 'accounts');

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.staff_role not null default 'reception',
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  room_type text not null default 'Standard',
  status public.room_status not null default 'available',
  nightly_rate numeric(12,2) not null default 100000 check (nightly_rate = 100000),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete restrict,
  guest_name text not null,
  guest_phone text,
  guest_email text,
  check_in date not null,
  check_out date not null,
  adults integer not null default 1 check (adults > 0),
  children integer not null default 0 check (children >= 0),
  status public.reservation_status not null default 'enquiry',
  nightly_rate numeric(12,2) not null default 100000 check (nightly_rate = 100000),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_status public.payment_status not null default 'unpaid',
  source text not null default 'direct',
  special_requests text,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (status = 'enquiry' or room_id is not null)
);

-- Confirmed and in-house stays cannot overlap for the same room.
alter table public.reservations
  add constraint reservations_no_overlapping_active_stays
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('confirmed', 'checked_in') and room_id is not null);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null,
  reference text,
  received_at timestamptz not null default now(),
  received_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.guest_follow_ups (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete cascade,
  guest_name text not null,
  guest_phone text,
  channel text not null default 'phone',
  due_at timestamptz not null,
  completed_at timestamptz,
  outcome text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index reservations_dates_idx on public.reservations (check_in, check_out);
create index reservations_status_idx on public.reservations (status);
create index reservations_guest_phone_idx on public.reservations (guest_phone);
create index payments_reservation_idx on public.payments (reservation_id);
create index follow_ups_due_idx on public.guest_follow_ups (due_at) where completed_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_set_updated_at before update on public.rooms
for each row execute function public.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations
for each row execute function public.set_updated_at();

-- Authorization helpers live outside the exposed public schema. They read the
-- protected staff table as the function owner to avoid recursive RLS policies.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_staff_role(allowed_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.role = any (allowed_roles)
  );
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.has_staff_role(public.staff_role[]) from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.has_staff_role(public.staff_role[]) to authenticated;

alter table public.staff_profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;
alter table public.guest_follow_ups enable row level security;

create policy "Staff can read staff profiles"
on public.staff_profiles for select to authenticated
using (private.is_staff());

create policy "Managers can manage staff profiles"
on public.staff_profiles for all to authenticated
using (private.has_staff_role(array['manager']::public.staff_role[]))
with check (private.has_staff_role(array['manager']::public.staff_role[]));

create policy "Staff can read rooms"
on public.rooms for select to authenticated
using (private.is_staff());
create policy "Managers and reception can manage rooms"
on public.rooms for all to authenticated
using (private.has_staff_role(array['manager','reception']::public.staff_role[]))
with check (private.has_staff_role(array['manager','reception']::public.staff_role[]));

create policy "Staff can read reservations"
on public.reservations for select to authenticated
using (private.is_staff());
create policy "Staff can create reservations"
on public.reservations for insert to authenticated
with check (private.is_staff());
create policy "Managers and reception can update reservations"
on public.reservations for update to authenticated
using (private.has_staff_role(array['manager','reception']::public.staff_role[]))
with check (private.has_staff_role(array['manager','reception']::public.staff_role[]));

create policy "Staff can read payments"
on public.payments for select to authenticated
using (private.is_staff());
create policy "Managers and accounts can record payments"
on public.payments for insert to authenticated
with check (private.has_staff_role(array['manager','accounts']::public.staff_role[]));

create policy "Staff can read follow ups"
on public.guest_follow_ups for select to authenticated
using (private.is_staff());
create policy "Staff can manage follow ups"
on public.guest_follow_ups for all to authenticated
using (private.is_staff())
with check (private.is_staff());

insert into public.rooms (room_number, room_type)
values
  ('01','Standard'),('02','Standard'),('03','Standard'),('04','Standard'),
  ('05','Standard'),('06','Standard'),('07','Standard'),('08','Standard'),
  ('09','Standard'),('10','Standard'),('11','Standard'),('12','Standard'),('13','Standard')
on conflict (room_number) do nothing;

-- Explicit grants are required for newly created tables on current Supabase projects.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert, update, delete on public.guest_follow_ups to authenticated;
