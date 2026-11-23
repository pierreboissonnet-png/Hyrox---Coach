// Analyse globale par Claude : l'app rassemble toutes les données (séances, niveau, plan, et santé si accord),
// la demande part en base ; Claude y dépose sa réponse directement (aucune mise à jour de l'app nécessaire).
import React, { useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, List, Switch, Empty, useToast, useLoad } from '../ui.jsx'
import { fmt, todayISO } from '../lib/hyrox.js'
import { athleteStats, summary } from '../lib/analyze.js'
import { gapsOf, withLevel, withSelf } from '../lib/gaps.js'
import { trainingLoad, sessionMinutes, sessionRPE } from '../lib/load.js'
import { isCustom, isQuick, isPlanned, customSummary, exLabel } from '../lib/custom.js'
import { wellNorm } from '../lib/program.js'
import { plansOf, upcoming, isAthlete } from './common.js'
import { soloTime } from '../lib/trend.js'
import { md } from './Session.jsx'

const ST = { new: ['En attente', 'warn'], doing: ['En cours d’analyse', 'accent'], done: ['Analyse disponible', 'good'], cancelled: ['Annulée', ''] }
const iso = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const r1 = x => x == null ? null : Math.round(x * 10) / 10

/** Données transmises à Claude : tout ce qui sert à juger la préparation, sans identifiant technique */
export async function globalPayload({ profile, sessions, teams, races, health }) {
  const plans = plansOf(teams), from = iso(56)
  const J = async k => { try { return await api.journal.list(k) } catch { return [] } }
  const [lv, pl] = await Promise.all([J('level'), J('plan')])
  const level = lv[0] || null, plan = pl[0] && pl[0].data
  const mine = sessions.filter(s => isAthlete(s, profile.id) && !isPlanned(s))
  const stats = withLevel(athleteStats(profile.id, sessions, plans), {}, level).stats
  const gaps = withSelf(gapsOf(stats, { profile }), level && level.data && level.data.self).filter(g => g.kind !== 'test').slice(0, 6).map(g => ({ point: g.label, pourquoi: g.why }))
  const seances = mine.filter(s => s.session_date >= from).sort((a, b) => a.session_date.localeCompare(b.session_date)).map(s => {
    const o = { date: s.session_date, nom: s.name, minutes: Math.round(sessionMinutes(s)), effort: sessionRPE(s) }
    if (s.data && s.data.stretch) return { ...o, type: 'étirements' }
    if (isQuick(s)) return { ...o, type: 'activité', activite: exLabel((s.data.steps || [])[0] || {}) }
    if (isCustom(s)) { const c = customSummary(s); return { ...o, type: 'séance perso', exercices: [...new Set(c.steps.map(exLabel))].slice(0, 8), objectifs_atteints: c.achievement != null ? Math.round(c.achievement * 100) + ' %' : null } }
    const sum = summary(s, s.plan || plans[s.team_id])
    return { ...o, type: 'Hyrox · ' + s.kind, duo: !!s.team_id, complet: sum.complete, temps: sum.all.n ? fmt(sum.all.t) : null, allure_course: sum.pace ? fmt(sum.pace) + '/km' : null,
      ateliers: sum.stations.filter(x => x.t != null).map(x => x.label + ' ' + fmt(x.t) + (x.d != null ? ' (' + (x.d > 0 ? '+' : '') + Math.round(x.d) + ' s)' : '')) }
  })
  const tl = trainingLoad(sessions, profile.id)
  const out = {
    athlete: { prenom: profile.display_name, sexe: profile.sex, age: profile.birth_year ? new Date().getFullYear() - profile.birth_year : null, poids_kg: profile.weight_kg, taille_cm: profile.height_cm, fc_max: profile.hr_max },
    courses: upcoming(races).slice(0, 4).map(r => ({ nom: r.name, date: r.race_date, format: r.format, division: r.division, priorite: r.priority, objectif: r.goal_seconds ? fmt(r.goal_seconds) : null })),
    duos: teams.filter(t => t.members.some(m => m.user_id === profile.id && !m.left_at)).map(t => ({ nom: t.name, partenaire: (t.members.find(m => m.user_id !== profile.id && !m.left_at) || {}).profile?.display_name || null })),
    estimation: { temps_solo_estime: soloTime(stats) ? fmt(soloTime(stats)) : null, allure_course: stats.pace ? fmt(stats.pace) + '/km' : null,
      ateliers: Object.fromEntries(Object.entries(stats.st || {}).filter(([, v]) => v).map(([k, v]) => [k, fmt(v)])) },
    lacunes: gaps,
    bilan_niveau: level ? level.data : null,
    plan: plan ? { course: plan.raceName, date: plan.raceDate, semaines: (plan.weeks || []).length, cree_le: plan.created, seances_par_semaine: plan.perWeek,
      semaine_en_cours: (plan.weeks || []).find(w => w.start <= todayISO() && todayISO() <= (w.days[6] || {}).date)?.days.map(d => d.date + ' ' + (d.title || d.key)) } : null,
    charge: { aigue_7j: Math.round(tl.acute), chronique_28j: Math.round(tl.chronic), ratio: r1(tl.ratio), seances_7j: tl.n7 },
    seances_8_semaines: seances,
  }
  if (health) {
    const [wb, sl, vi, pa, we] = await Promise.all([J('wellbeing'), J('sleep'), J('vitals'), J('pain'), J('weight')])
    const avg = (L, f) => { const x = L.map(f).filter(v => v != null); return x.length ? r1(x.reduce((a, b) => a + b, 0) / x.length) : null }
    const wb14 = wb.filter(e => e.day >= iso(14)).map(wellNorm), sl14 = sl.filter(e => e.day >= iso(14)), vi14 = vi.filter(e => e.day >= iso(14))
    out.sante = {
      forme_14j: wb14.length ? { saisies: wb14.length, fatigue: avg(wb14, w => w.fatigue), sommeil_ressenti: avg(wb14, w => w.sleep), courbatures: avg(wb14, w => w.soreness), moral: avg(wb14, w => w.mood), echelle: '0 à 5' } : null,
      sommeil_14j: sl14.length ? { nuits: sl14.length, moyenne_h: r1(avg(sl14, e => e.data.asleep) / 60) } : null,
      montre_14j: vi14.length ? { fc_repos: avg(vi14, e => e.data.rhr), vfc_ms: avg(vi14, e => e.data.hrv), pas: avg(vi14, e => e.data.steps) } : null,
      douleurs_actives: pa.filter(e => e.data && e.data.status !== 'resolved').slice(0, 5).map(e => ({ zone: e.data.zone, niveau: e.data.level, depuis: e.day })),
      poids_recent: we.slice(0, 3).map(e => ({ date: e.day, kg: e.data.kg })),
    }
  }
  return out
}

export function AnalysisPage() {
  const app = useApp(), { profile, user } = app, toast = useToast()
  const reqs = useLoad(() => api.coach.globalRequests(user.id), [])
  const ans = useLoad(() => api.coach.globalAnswers(user.id), [])
  const [q, setQ] = useState(''), [health, setHealth] = useState(!!profile.consent_health), [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [preview, setPreview] = useState(null)
  const pending = (reqs.data || []).filter(r => r.status === 'new' || r.status === 'doing')
  async function send() {
    setBusy(true)
    try {
      const payload = await globalPayload({ ...app, health: health && profile.consent_health })
      const r = await api.coach.request({ session_id: null, pseudo: profile.display_name || '', question: q.trim().slice(0, 1500), payload })
      toast(`Demande n°${r.no} envoyée : la réponse de Claude apparaîtra ici`); setQ(''); setOk(false); reqs.reload()
    } catch (e) { toast(/session_id|null value|violates/i.test(e.message) ? 'Analyse globale pas encore activée : script « analyse-globale.sql » à exécuter dans Supabase' : e.message) } finally { setBusy(false) }
  }
  return <Page back="#/moi" title="Analyse globale par Claude" subtitle="Toute votre préparation passée au crible : séances, niveau, plan, charge et (si vous l’acceptez) santé.">
    {(ans.data || []).length > 0 && <>{(ans.data || []).map((a, i) => <div key={a.id} className="glass card" style={i ? { opacity: .85 } : null}>
      <div className="row-gap"><b>{i === 0 ? 'Dernière analyse' : 'Analyse du ' + new Date(a.created_at).toLocaleDateString('fr-FR')}</b><span className="spacer" /><span className="badge">{new Date(a.created_at).toLocaleDateString('fr-FR')}</span></div>
      <div className="small" style={{ marginTop: 6 }}>{i === 0 ? md(a.content) : <details><summary>Relire</summary>{md(a.content)}</details>}</div>
    </div>)}</>}
    {(reqs.data || []).length > 0 && <div className="glass card small">{(reqs.data || []).slice(0, 5).map(r => <div className="row-gap" key={r.id} style={{ marginBottom: 4 }}><span className="num faint">n°{r.no}</span><span className={'badge ' + ST[r.status][1]}>{ST[r.status][0]}</span><span className="muted">{new Date(r.created_at).toLocaleDateString('fr-FR')}{r.question ? ' · « ' + r.question.slice(0, 50) + (r.question.length > 50 ? '…' : '') + ' »' : ''}</span></div>)}</div>}
    <h2 className="sec">Nouvelle demande</h2>
    {pending.length ? <div className="glass card small"><b>Demande en cours de traitement.</b><div className="muted">Claude dépose sa réponse directement ici (pas besoin de mettre l’application à jour). Vous pourrez en redemander une ensuite.</div></div> : <>
      <List>
        <div className="row stack"><span className="small muted">Votre question (facultatif)</span><textarea rows={3} value={q} onChange={e => setQ(e.target.value)} placeholder="Ex. suis-je dans les temps pour mon objectif ? Que prioriser d’ici la course ? Ma charge est-elle bien dosée ?" /></div>
        {profile.consent_health && <div className="row"><span className="label"><span className="t">Inclure ma santé</span><span className="s">Forme, sommeil, FC au repos, variabilité, douleurs, poids (moyennes des 14 derniers jours)</span></span><Switch checked={health} onChange={setHealth} label="Inclure ma santé" /></div>}
        <div className="row"><span className="label"><span className="t">J’accepte la transmission à Claude</span><span className="s">Prénom, sexe, âge, poids, séances des 8 dernières semaines, bilan de niveau, plan, courses{health && profile.consent_health ? ', moyennes santé' : ''}. Aucun cycle menstruel ni prise de sang.</span></span><Switch checked={ok} onChange={setOk} label="Accord de transmission" /></div>
      </List>
      <div className="row-gap" style={{ marginTop: 10 }}>
        <button className="btn glass small" onClick={async () => setPreview(preview ? null : await globalPayload({ ...app, health: health && profile.consent_health }))}>{preview ? 'Masquer les données' : 'Voir les données envoyées'}</button>
        <button className="btn" style={{ flex: 1 }} disabled={!ok || busy} onClick={send}>{busy ? 'Envoi…' : 'Demander l’analyse globale'}</button></div>
      {preview && <pre className="tiny mono glass card" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(preview, null, 1)}</pre>}
    </>}
    {!(ans.data || []).length && !(reqs.data || []).length && <div className="glass card"><Empty icon="spark">Aucune analyse pour l’instant.</Empty></div>}
    <p className="foot">La réponse est rédigée par Claude puis déposée dans l’application par l’administrateur, généralement sous 24 h. Ce n’est pas un avis médical.</p>
  </Page>
}
