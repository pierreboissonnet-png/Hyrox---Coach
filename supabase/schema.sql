-- =====================================================================
-- Hyrox Coach · schéma Supabase (PostgreSQL)
-- À coller dans Supabase › SQL Editor › New query › Run (une seule fois).
-- Toutes les tables sont protégées par des règles d'accès (RLS) :
--   · données de santé, nutrition, programme : visibles par leur seul propriétaire ;
--   · équipes, courses d'équipe, séances, cardio de séance : visibles par les membres de l'équipe.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Profils ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  sex text check (sex in ('F','M','X')),
  birth_year int check (birth_year between 1920 and 2020),
  weight_kg numeric(5,1),
  height_cm numeric(5,1),
  hr_max int,
  hr_zones int[] default '{0,0,0,0,0}',           -- FC de début des zones 1..5 (zone 1 = 0)
  consent_health boolean not null default false, -- accord explicite pour stocker des données de santé
  consent_ai boolean not null default false,     -- accord pour l'analyse automatique des séances par Claude (IA)
  created_at timestamptz not null default now()
);

-- (mise à jour d'une base créée avec une version précédente du script)
alter table public.profiles add column if not exists consent_ai boolean not null default false;

-- Profil créé automatiquement à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Équipes (duo) ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  division text not null default 'open' check (division in ('open','pro')),
  category text not null default 'mixte' check (category in ('homme','femme','mixte')),
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  plan jsonb not null default '{}'::jsonb,       -- objectifs + stratégie de relais (même format que Chrono Hyrox Duo)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (team_id, user_id)
);

-- Membre (actuel ou ancien) : garde l'accès aux séances passées pour les statistiques personnelles
create or replace function public.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from team_members where team_id = t and user_id = auth.uid());
$$;
create or replace function public.is_active_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from team_members where team_id = t and user_id = auth.uid() and left_at is null);
$$;
-- Partage au moins une équipe avec l'utilisateur (pour lire le profil du partenaire)
create or replace function public.shares_team(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from team_members a join team_members b on a.team_id = b.team_id
                where a.user_id = auth.uid() and b.user_id = u);
$$;

-- Créer une équipe (et en devenir membre)
create or replace function public.create_team(p_name text, p_division text, p_category text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  insert into teams (name, division, category, created_by) values (p_name, p_division, p_category, auth.uid()) returning id into t;
  insert into team_members (team_id, user_id) values (t, auth.uid());
  perform public.claim_team_sessions(t);   -- reprend les séances importées avant son arrivée
  return t;
end $$;

-- Rejoindre une équipe avec son code (2 membres actifs maximum)
create or replace function public.join_team(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid; n int;
begin
  select id into t from teams where invite_code = upper(trim(p_code));
  if t is null then raise exception 'Code inconnu'; end if;
  -- Un duo = deux personnes pour toujours : un ancien membre peut revenir, un nouveau partenaire crée une nouvelle équipe
  -- (ainsi, il ne voit jamais les séances et le cardio de l'ancien partenaire).
  if exists(select 1 from team_members where team_id = t and user_id = auth.uid()) then
    update team_members set left_at = null where team_id = t and user_id = auth.uid();
    return t;
  end if;
  select count(*) into n from team_members where team_id = t;
  if n >= 2 then raise exception 'Ce duo a déjà ses deux membres : créez une nouvelle équipe avec votre nouveau partenaire'; end if;
  insert into team_members (team_id, user_id) values (t, auth.uid());
  perform public.claim_team_sessions(t);   -- reprend les séances importées avant son arrivée
  return t;
end $$;

-- Quitter une équipe (l'historique est conservé)
create or replace function public.leave_team(p_team uuid) returns void
language sql security definer set search_path = public as $$
  update team_members set left_at = now() where team_id = p_team and user_id = auth.uid() and left_at is null;
$$;

-- ---------- Courses Hyrox prévues / réalisées ----------
create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,   -- renseigné pour un duo
  name text not null,
  city text,
  race_date date not null,
  format text not null default 'solo' check (format in ('solo','duo')),
  division text not null default 'open' check (division in ('open','pro')),
  category text check (category in ('homme','femme','mixte')),
  goal_seconds int,
  result_seconds int,
  notes text default '',
  created_at timestamptz not null default now()
);

-- Priorité : A = objectif principal (pilote le programme), B = course importante, C = course de préparation
alter table public.races add column if not exists priority text not null default 'B' check (priority in ('A','B','C'));

-- ---------- Séances (entraînement, simulation, course) ----------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  session_date date not null default current_date,
  kind text not null default 'entrainement' check (kind in ('entrainement','simulation','course')),
  athletes jsonb not null default '{}'::jsonb,  -- {"A": user_id, "B": user_id}
  data jsonb not null default '{}'::jsonb,      -- startedAt, cp, relays, runs, units, runKm, note
  plan jsonb,                                   -- copie du plan du duo au départ (utile au pointeur extérieur)
  names jsonb not null default '{}'::jsonb,     -- {"A": "Pierre", "B": "Laurent"}
  timekeeper uuid references auth.users(id) on delete set null,  -- personne qui enregistre les temps
  keeper_code text unique default upper(substr(md5(random()::text), 1, 6)),  -- code pour confier le pointage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- (mise à jour d'une base créée avec une version précédente du script)
alter table public.sessions add column if not exists plan jsonb;
alter table public.sessions add column if not exists names jsonb not null default '{}'::jsonb;
alter table public.sessions add column if not exists timekeeper uuid references auth.users(id) on delete set null;
alter table public.sessions add column if not exists keeper_code text unique default upper(substr(md5(random()::text), 1, 6));

-- ---------- Cardio d'une séance (une ligne par athlète) ----------
create table if not exists public.hr_series (
  session_id uuid references public.sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  t int[] not null,          -- secondes depuis le départ
  bpm smallint[] not null,
  source text default '',
  offset_s int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- ---------- Séances importées avant l'arrivée du partenaire ----------
-- Quand le partenaire rejoint le duo, il prend la place laissée libre (son prénom est déjà connu) et récupère son cardio importé.
create or replace function public.claim_team_sessions(t uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; w text; h jsonb;
begin
  for r in select id, athletes, names, data from sessions where team_id = t loop
    if r.athletes->>'A' = auth.uid()::text or r.athletes->>'B' = auth.uid()::text then continue; end if;
    w := null;
    if coalesce(r.athletes->>'A', '') = '' and coalesce(r.names->>'A', '') <> '' then w := 'A';
    elsif coalesce(r.athletes->>'B', '') = '' and coalesce(r.names->>'B', '') <> '' then w := 'B'; end if;
    if w is null then continue; end if;
    update sessions set athletes = jsonb_set(coalesce(athletes, '{}'::jsonb), array[w], to_jsonb(auth.uid()::text)) where id = r.id;
    h := r.data->'pendingHr'->w;
    if h is not null then
      insert into hr_series (session_id, user_id, t, bpm, source, offset_s)
      values (r.id, auth.uid(),
        array(select x::int from jsonb_array_elements_text(h->'t') with ordinality a(x, i) order by i),
        array(select x::smallint from jsonb_array_elements_text(h->'bpm') with ordinality a(x, i) order by i),
        coalesce(h->>'source', 'import'), coalesce((h->>'offset_s')::int, 0))
      on conflict (session_id, user_id) do nothing;
      update sessions set data = data #- array['pendingHr', w] where id = r.id;
    end if;
  end loop;
end $$;

-- ---------- Journal personnel (privé) ----------
-- kind : weight, blood, cycle, nutrition, supplements, program, run, wellbeing
create table if not exists public.journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null,
  day date not null default current_date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists journal_user_kind on public.journal (user_id, kind, day);

-- ---------- Conseils du coach IA (écrits par la fonction « coach ») ----------
create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,  -- destinataire
  scope text not null default 'session' check (scope in ('session','station','semaine')),
  station text,
  content text not null,
  model text default '',
  created_at timestamptz not null default now()
);
create index if not exists coach_session on public.coach_feedback (session_id, created_at);

-- ---------- Signalement de bugs (même principe que l'appli Quiz CI BSPP) ----------
create table if not exists public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from app_admins where user_id = auth.uid());
$$;
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity unique,  -- numéro à citer (« signalement n°12 »)
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  pseudo text not null default '',
  text text not null check (length(text) between 3 and 2000),
  ctx jsonb not null default '{}'::jsonb,         -- écran, version, appareil, erreurs JS, dernières actions… (aucune donnée de santé)
  img text,                                       -- capture d'écran prise au moment du clic (JPEG en data URL)
  has_img boolean generated always as (img is not null) stored,
  status text not null default 'new' check (status in ('new','doing','done','wontfix')),
  note text not null default '',                  -- note de suivi (administrateur ou Claude)
  analysis text not null default '',              -- premier diagnostic automatique de Claude
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
-- Anti-abus : au plus 30 signalements EN ATTENTE (non traités) envoyés en 24 h ; les administrateurs ne sont pas limités
create or replace function public.bug_quota_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (select count(*) from bug_reports where user_id = auth.uid() and created_at > now() - interval '1 day' and status in ('new','doing')) < 30;
$$;
-- Accès de service pour Claude (fonction « bugs-api ») : peut être coupé par un administrateur
create table if not exists public.app_config (key text primary key, value jsonb not null default '{}'::jsonb);
insert into public.app_config (key, value) values ('bugapi', '{"off": false, "n": 0}') on conflict do nothing;

-- ---------- Pointage confié à une autre personne ----------
-- Profils visibles entre un athlète et la personne qui pointe sa séance
create or replace function public.shares_session(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from sessions s where
    (s.timekeeper = u and (s.owner = auth.uid() or s.athletes->>'A' = auth.uid()::text or s.athletes->>'B' = auth.uid()::text))
    or (s.timekeeper = auth.uid() and (s.owner = u or s.athletes->>'A' = u::text or s.athletes->>'B' = u::text)));
$$;
-- Devenir pointeur d'une séance avec son code
create or replace function public.claim_timekeeper(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  update sessions set timekeeper = auth.uid() where keeper_code = upper(trim(p_code)) returning id into sid;
  if sid is null then raise exception 'Code de pointage inconnu'; end if;
  return sid;
end $$;
-- Le pointeur ne peut modifier que les temps et la note (pas l'équipe, les athlètes, le propriétaire…)
create or replace function public.guard_timekeeper() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = old.timekeeper and old.owner <> auth.uid()
     and not (old.team_id is not null and public.is_active_member(old.team_id)) then
    if new.owner is distinct from old.owner or new.team_id is distinct from old.team_id or new.athletes is distinct from old.athletes
       or new.plan is distinct from old.plan or new.keeper_code is distinct from old.keeper_code
       or (new.timekeeper is distinct from old.timekeeper and new.timekeeper is not null) then
      raise exception 'Le pointeur ne peut modifier que les temps';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sessions_guard on public.sessions;
create trigger sessions_guard before update on public.sessions for each row execute function public.guard_timekeeper();

-- ---------- Synchronisation automatique avec l'app Santé (iPhone) ----------
-- Jeton personnel (seule son empreinte est stockée), utilisé par le Raccourci iPhone ou Health Auto Export
create table if not exists public.health_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  token_hash text unique not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_used timestamptz,
  last_summary text not null default ''
);
-- Fréquence cardiaque brute reçue de Santé, par jour (UTC) : privée
create table if not exists public.hr_samples (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  t int[] not null,          -- secondes depuis minuit UTC
  bpm smallint[] not null,
  source text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------- Analyse approfondie en 2 temps (même principe que les bugs) ----------
-- 1) l'application rédige une première analyse (coach intégré) ;
-- 2) l'utilisateur demande une analyse approfondie : la demande attend ici, Claude la lit
--    (fonction « coach-api » + clé BUG_API_KEY) et dépose sa réponse dans coach_feedback.
create table if not exists public.coach_requests (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity unique,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  pseudo text not null default '',
  question text not null default '',
  payload jsonb not null default '{}'::jsonb,   -- résumé de la séance (temps, objectifs, réalisé, cardio si accepté)
  status text not null default 'new' check (status in ('new','doing','done','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.coach_feedback add column if not exists request_id uuid references public.coach_requests(id) on delete set null;

-- =====================================================================
-- Règles d'accès (RLS)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.races enable row level security;
alter table public.sessions enable row level security;
alter table public.hr_series enable row level security;
alter table public.journal enable row level security;
alter table public.coach_feedback enable row level security;
alter table public.health_tokens enable row level security;
alter table public.coach_requests enable row level security;
alter table public.hr_samples enable row level security;
alter table public.app_admins enable row level security;
alter table public.bug_reports enable row level security;

-- Profils : soi-même ; un coéquipier voit le profil (nom, sexe, poids, zones) de son partenaire
drop policy if exists p_read on public.profiles;
create policy p_read on public.profiles for select using (id = auth.uid() or public.shares_team(id) or public.shares_session(id));
drop policy if exists p_write on public.profiles;
create policy p_write on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists p_ins on public.profiles;
create policy p_ins on public.profiles for insert with check (id = auth.uid());
-- Comptes créés avant l'exécution de ce script : on leur crée leur profil
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)) from auth.users
on conflict (id) do nothing;

-- Équipes : membres (actuels et anciens) ; modification par les membres actifs
drop policy if exists t_read on public.teams;
create policy t_read on public.teams for select using (public.is_member(id));
drop policy if exists t_write on public.teams;
create policy t_write on public.teams for update using (public.is_active_member(id));

drop policy if exists tm_read on public.team_members;
create policy tm_read on public.team_members for select using (public.is_member(team_id));

-- Courses : le propriétaire, ou les membres de l'équipe pour une course de duo
drop policy if exists r_read on public.races;
create policy r_read on public.races for select using (user_id = auth.uid() or (team_id is not null and public.is_member(team_id)));
drop policy if exists r_ins on public.races;
create policy r_ins on public.races for insert with check (user_id = auth.uid() and (team_id is null or public.is_active_member(team_id)));
drop policy if exists r_upd on public.races;
create policy r_upd on public.races for update using (user_id = auth.uid() or (team_id is not null and public.is_active_member(team_id)));
drop policy if exists r_del on public.races;
create policy r_del on public.races for delete using (user_id = auth.uid());

-- Séances : le créateur, ou les membres de l'équipe
drop policy if exists s_read on public.sessions;
create policy s_read on public.sessions for select using (owner = auth.uid() or timekeeper = auth.uid() or (team_id is not null and public.is_member(team_id)));
drop policy if exists s_ins on public.sessions;
create policy s_ins on public.sessions for insert with check (owner = auth.uid() and (team_id is null or public.is_active_member(team_id)));
drop policy if exists s_upd on public.sessions;
create policy s_upd on public.sessions for update using (owner = auth.uid() or timekeeper = auth.uid() or (team_id is not null and public.is_active_member(team_id)));
drop policy if exists s_del on public.sessions;
create policy s_del on public.sessions for delete using (owner = auth.uid() or (team_id is not null and public.is_active_member(team_id)));

-- Cardio : lisible par ceux qui voient la séance ; écrit par l'athlète ou un membre actif de l'équipe (import par le pointeur)
create or replace function public.can_see_session(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from sessions s where s.id = sid and (s.owner = auth.uid() or (s.team_id is not null and public.is_member(s.team_id))));
$$;
create or replace function public.can_edit_session(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from sessions s where s.id = sid and (s.owner = auth.uid() or (s.team_id is not null and public.is_active_member(s.team_id))));
$$;
drop policy if exists h_read on public.hr_series;
create policy h_read on public.hr_series for select using (public.can_see_session(session_id));
drop policy if exists h_write on public.hr_series;
create policy h_write on public.hr_series for all using (public.can_edit_session(session_id)) with check (public.can_edit_session(session_id));

-- Journal : strictement privé
drop policy if exists j_all on public.journal;
create policy j_all on public.journal for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Demandes d'analyse approfondie : l'auteur (pour une séance qu'il voit) ; les administrateurs voient tout
drop policy if exists cr_ins on public.coach_requests;
create policy cr_ins on public.coach_requests for insert with check (user_id = auth.uid() and status = 'new' and public.can_see_session(session_id));
drop policy if exists cr_read on public.coach_requests;
create policy cr_read on public.coach_requests for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists cr_upd on public.coach_requests;
create policy cr_upd on public.coach_requests for update using (user_id = auth.uid() or public.is_admin());

-- Synchronisation Santé : strictement privé
drop policy if exists ht_all on public.health_tokens;
create policy ht_all on public.health_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists hs_all on public.hr_samples;
create policy hs_all on public.hr_samples for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Conseils IA : le destinataire, et les membres de l'équipe pour les conseils de séance d'équipe
drop policy if exists c_read on public.coach_feedback;
create policy c_read on public.coach_feedback for select using (user_id = auth.uid() or (session_id is not null and public.can_see_session(session_id)));
-- Coach local (gratuit) : l'application enregistre elle-même l'analyse, pour une séance que l'on voit
drop policy if exists c_ins on public.coach_feedback;
create policy c_ins on public.coach_feedback for insert with check (session_id is not null and ((user_id = auth.uid() and public.can_see_session(session_id)) or public.is_admin()));

-- Bugs : chacun crée et voit ses signalements ; les administrateurs voient, traitent et suppriment tout
drop policy if exists b_ins on public.bug_reports;
create policy b_ins on public.bug_reports for insert with check (user_id = auth.uid() and status = 'new' and public.bug_quota_ok());
drop policy if exists b_read on public.bug_reports;
create policy b_read on public.bug_reports for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists b_upd on public.bug_reports;
create policy b_upd on public.bug_reports for update using (public.is_admin());
drop policy if exists b_del on public.bug_reports;
create policy b_del on public.bug_reports for delete using (public.is_admin());
drop policy if exists a_read on public.app_admins;
create policy a_read on public.app_admins for select using (user_id = auth.uid());
alter table public.app_config enable row level security;
drop policy if exists cfg_admin on public.app_config;
create policy cfg_admin on public.app_config for all using (public.is_admin()) with check (public.is_admin());

-- Suivi en direct du pointage (les autres membres voient les temps arriver)
do $$ begin
  alter publication supabase_realtime add table public.sessions;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.coach_feedback;
exception when others then null; end $$;

-- Pour vous déclarer administrateur (lecture de tous les bugs), après votre inscription :
--   insert into public.app_admins (user_id) select id from auth.users where email = 'votre@email';

-- =====================================================================
-- Droits d'accès aux tables pour l'application (Data API)
-- Les projets Supabase récents n'exposent plus automatiquement les nouvelles tables :
-- sans ces lignes, l'application affiche « permission denied for table … ».
-- Les règles RLS ci-dessus continuent de limiter ce que chacun voit.
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
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
