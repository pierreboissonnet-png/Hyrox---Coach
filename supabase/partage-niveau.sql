-- Hyrox Coach 1.11 : partage du niveau avec son duo
-- ---------- Partage du bilan « Mon niveau » avec son duo (sur accord explicite) ----------
-- Copie du bilan, lisible uniquement par les coéquipiers ACTUELS ; le journal reste strictement privé.
create or replace function public.shares_active_team(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from team_members a join team_members b on a.team_id = b.team_id
                where a.user_id = auth.uid() and b.user_id = u and a.left_at is null and b.left_at is null);
$$;
create table if not exists public.shared_levels (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.shared_levels enable row level security;
drop policy if exists sl_read on public.shared_levels;
create policy sl_read on public.shared_levels for select using (user_id = auth.uid() or public.shares_active_team(user_id));
drop policy if exists sl_write on public.shared_levels;
create policy sl_write on public.shared_levels for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.shared_levels to authenticated;
