-- ============================================================================
-- Échanges sur un signalement : précisions du membre, réponses de l'équipe
-- ============================================================================
create table if not exists public.bug_comments (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bug_reports(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  pseudo text not null default '',
  text text not null check (char_length(text) between 1 and 2000),
  img text check (img is null or length(img) < 900000),
  from_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bug_comments_bug on public.bug_comments (bug_id, created_at);
alter table public.bug_comments enable row level security;
create or replace function public.bug_is_mine(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from bug_reports where id = b and user_id = auth.uid());
$$;
drop policy if exists bc_read on public.bug_comments;
create policy bc_read on public.bug_comments for select using (public.bug_is_mine(bug_id) or public.is_admin());
drop policy if exists bc_ins on public.bug_comments;
create policy bc_ins on public.bug_comments for insert with check (user_id = auth.uid() and (public.bug_is_mine(bug_id) or public.is_admin()) and from_admin = public.is_admin());
drop policy if exists bc_del on public.bug_comments;
create policy bc_del on public.bug_comments for delete using (public.is_admin() or user_id = auth.uid());
-- Une précision du membre remet le signalement « Nouveau » pour qu'il soit relu
create or replace function public.bug_comment_reopen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.from_admin then
    update bug_reports set status = 'new', updated_at = now() where id = new.bug_id and status <> 'new';
  else
    update bug_reports set updated_at = now() where id = new.bug_id;
  end if;
  return new;
end $$;
drop trigger if exists bug_comment_reopen on public.bug_comments;
create trigger bug_comment_reopen after insert on public.bug_comments for each row execute function public.bug_comment_reopen();
grant select, insert, delete on public.bug_comments to authenticated;
grant all on public.bug_comments to service_role;
grant execute on function public.bug_is_mine(uuid) to authenticated, service_role;
