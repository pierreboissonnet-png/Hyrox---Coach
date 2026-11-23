-- Hyrox Coach 1.12 : analyse globale par Claude
-- ---------- Analyse globale par Claude (toutes les données, sans mise à jour de l'app) ----------
-- Une demande sans séance (session_id vide) = analyse globale ; la réponse est déposée dans coach_feedback (scope « global »).
alter table public.coach_requests alter column session_id drop not null;
alter table public.coach_feedback drop constraint if exists coach_feedback_scope_check;
alter table public.coach_feedback add constraint coach_feedback_scope_check check (scope in ('session','station','semaine','global'));
drop policy if exists cr_ins on public.coach_requests;
create policy cr_ins on public.coach_requests for insert with check (user_id = auth.uid() and status = 'new' and (session_id is null or public.can_see_session(session_id)));
drop policy if exists c_ins on public.coach_feedback;
create policy c_ins on public.coach_feedback for insert with check (
  (session_id is not null and ((user_id = auth.uid() and public.can_see_session(session_id)) or public.is_admin()))
  or (session_id is null and public.is_admin()));
