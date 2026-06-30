create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  message text,
  source text default 'landing',
  created_at timestamptz not null default now()
);

grant insert on public.leads to anon, authenticated;
grant all on public.leads to service_role;

alter table public.leads enable row level security;

create policy "anyone can submit a lead"
  on public.leads
  for insert
  to anon, authenticated
  with check (true);
