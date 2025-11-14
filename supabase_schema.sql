create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('super_admin','school_admin','driver','teacher','parent')),
  school_id uuid references public.schools(id),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.schools enable row level security;

create policy "Profiles: user can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles: super admin can do anything" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );
