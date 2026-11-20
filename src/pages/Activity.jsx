// Saisie rapide d'une activité faite en plus du plan (course, vélo, sport, renfo…) : compte dans la charge,
// la dépense du jour, la progression du plan et les analyses.
import React, { useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { List, Field, Sheet, useToast, parseNum } from '../ui.jsx'
import { todayISO, frDate, parseT, fmt } from '../lib/hyrox.js'
import { EX } from '../lib/custom.js'
import { quickSession } from '../lib/activity.js'
export { quickSession }

// Uniquement ce qui sert la prépa Hyrox (les autres sports restent lisibles sur les anciennes saisies, via « Autre activité »)
export const ACTIVITIES = ['run', 'bike', 'airbike', 'row', 'ski', 'elliptical', 'stairs', 'swim', 'walk', 'hike', 'rope', 'strength', 'mobility', 'yoga', 'other']
const DIST = ['run', 'bike', 'swim', 'row', 'ski', 'walk', 'hike']

export function QuickSheet({ onClose, date: d0, session }) {
  const { user, profile, reload } = useApp(), toast = useToast()
  const init = () => { if (!session) return { ex: 'run', name: '', date: d0 || todayISO(), dur: '45', km: '', rpe: 6, hr: '', note: '' }
    const st = (session.data.steps || [])[0] || {}, dn = st.done || {}
    return { ex: st.ex || 'other', name: st.ex === 'other' || ['teamsport', 'strength'].includes(st.ex) ? (session.name !== (EX[st.ex] || {}).label ? session.name : '') : '', date: session.session_date,
      dur: dn.time ? String(Math.round(dn.time / 60)) : '', km: dn.meters ? String(Math.round(dn.meters / 10) / 100).replace('.', ',') : '', rpe: dn.rpe || 6, hr: session.data.avgHR ? String(session.data.avgHR) : '', note: session.data.note || '' } }
  const [f, setF] = useState(init)
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    setErr('')
    const t = String(f.dur).includes(':') ? parseT(f.dur) / 60 : parseNum(f.dur)
    if (!t || Number.isNaN(t) || t <= 0 || t > 600) return setErr('Durée : en minutes (45) ou en h:mm (1:15:00)')
    const km = parseNum(f.km); if (String(f.km).trim() && (km == null || km <= 0 || km > 300)) return setErr('Distance en km, par exemple 8,5')
    const hr = parseNum(f.hr); if (String(f.hr).trim() && (hr == null || hr < 60 || hr > 220)) return setErr('Fréquence cardiaque moyenne entre 60 et 220')
    if (f.date > todayISO()) return setErr('Pour une séance à venir, utilisez « Planifier une séance ».')
    setBusy(true)
    try {
      const q = quickSession({ uid: user.id, name: f.ex === 'other' ? f.name.trim() || 'Activité' : f.name.trim(), ex: f.ex, date: f.date, minutes: t, km, rpe: f.rpe, avgHR: hr, note: f.note })
      if (session) await api.sessions.save({ id: session.id, name: q.name, session_date: q.session_date, data: { ...session.data, ...q.data, ...(session.data.auto ? { auto: true, extId: session.data.extId, startMs: session.data.startMs, kcal: session.data.kcal } : {}) } })
      else await api.sessions.save(q)
      await reload(['sessions']); toast(session ? 'Activité modifiée' : 'Activité ajoutée'); onClose(true)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const pace = DIST.includes(f.ex) && parseNum(f.km) && parseNum(f.dur) ? parseNum(f.dur) * 60 / parseNum(f.km) : null
  return <Sheet title={session ? 'Modifier l’activité' : 'Activité en plus du plan'} onClose={() => onClose(false)} actions={<button className="btn plain" onClick={save} disabled={busy}>{session ? 'OK' : 'Ajouter'}</button>}
    footer={<button className="btn block" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : session ? 'Enregistrer les modifications' : 'Ajouter l’activité'}</button>}>
    <p className="small muted" style={{ marginTop: 0 }}>Footing, vélo, rameur, séance de renfo à la salle… Elle compte dans votre charge d’entraînement, la dépense du jour et le suivi du plan.</p>
    <List>
      <Field label="Activité"><select value={f.ex} onChange={e => setF({ ...f, ex: e.target.value })}>{(ACTIVITIES.includes(f.ex) ? ACTIVITIES : [...ACTIVITIES, f.ex]).map(id => <option key={id} value={id}>{EX[id].label}</option>)}</select></Field>
      {(f.ex === 'other' || f.ex === 'teamsport' || f.ex === 'strength') && <Field label="Nom" sub="Facultatif"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder={f.ex === 'teamsport' ? 'Match de foot' : f.ex === 'strength' ? 'Renfo salle' : 'Cours de cross training'} /></Field>}
      <Field label="Date"><input type="date" value={f.date} max={todayISO()} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
      <Field label="Durée" sub="minutes, ou h:mm:ss"><input inputMode="decimal" value={f.dur} onChange={e => setF({ ...f, dur: e.target.value })} /></Field>
      {DIST.includes(f.ex) && <Field label="Distance (km)" sub={pace ? (f.ex === 'run' || f.ex === 'walk' || f.ex === 'hike' ? 'allure ' + fmt(pace) + '/km' : '') : 'Facultatif'}><input inputMode="decimal" value={f.km} onChange={e => setF({ ...f, km: e.target.value })} /></Field>}
      <div className="row stack"><div className="row-gap"><span>Effort ressenti</span><span className="spacer" /><b>{f.rpe}/10</b><span className="small muted">{['', 'très facile', 'très facile', 'facile', 'modéré', 'modéré', 'soutenu', 'difficile', 'très difficile', 'très difficile', 'maximal'][f.rpe]}</span></div>
        <input type="range" min="1" max="10" value={f.rpe} onChange={e => setF({ ...f, rpe: +e.target.value })} aria-label="Effort ressenti" /></div>
      {profile.consent_health && <Field label="FC moyenne" sub="Facultatif, pour une dépense plus juste"><input inputMode="numeric" value={f.hr} onChange={e => setF({ ...f, hr: e.target.value })} placeholder="bpm" /></Field>}
      <div className="row stack"><span className="small muted">Note</span><textarea value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Sensations, parcours…" /></div>
    </List>
    {err && <p className="err">{err}</p>}
    <p className="foot">Le cardio détaillé de la montre peut être ajouté ensuite depuis la séance (onglet Cardio).</p>
  </Sheet>
}
