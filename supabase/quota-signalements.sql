-- Hyrox Coach : les signalements déjà traités ne comptent plus dans la limite quotidienne
-- Anti-abus : au plus 30 signalements EN ATTENTE (non traités) envoyés en 24 h ; les administrateurs ne sont pas limités
create or replace function public.bug_quota_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (select count(*) from bug_reports where user_id = auth.uid() and created_at > now() - interval '1 day' and status in ('new','doing')) < 30;
$$;
