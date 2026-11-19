import React, { useEffect, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Field, Seg, Sheet, Empty, Icon, useToast } from '../ui.jsx'
import { fmt, parseT, frDate, daysUntil, todayISO } from '../lib/hyrox.js'
import { RACE_TYPE, activeTeams, mainRace, upcoming, PRIORITY, teamName } from './common.js'

export default function Races() {
  const { races, profile, teams } = useApp()
  const [edit, setEdit] = useState(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => { try { const pf = JSON.parse(localStorage.getItem('hx-race-prefill') || 'null'); if (pf) { localStorage.removeItem('hx-race-prefill'); setEdit({ ...blank, ...pf }) } } catch {} }, [])
  const shown = races.filter(r => filter === 'all' || (filter === 'solo' ? r.format === 'solo' : r.team_id === filter))
  const up = shown.filter(r => r.race_date >= todayISO()), past = shown.filter(r => r.race_date < todayISO()).reverse()
  const main = mainRace(races)
  const blank = { name: '', city: '', race_date: '', format: 'solo', division: 'open', category: profile.sex === 'F' ? 'femme' : 'homme', team_id: null, goal_seconds: null, result_seconds: null, notes: '', priority: upcoming(races).length ? 'B' : 'A' }
  const item = r => <Row key={r.id} icon="flag" color={r.priority === 'A' ? '#ff375f' : r.format === 'duo' ? '#ff9f0a' : '#0a84ff'} title={<>{r.name}{main && r.id === main.id && <span className="badge accent" style={{ marginLeft: 6 }}>programme</span>}</>} onClick={() => setEdit(r)}
    sub={`${frDate(r.race_date)}${r.city ? ' · ' + r.city : ''} · ${RACE_TYPE(r)}${r.team_id ? ' · ' + (teamName(teams, r.team_id) || 'duo') : ''} · ${PRIORITY[r.priority || 'B']}`}
    value={r.result_seconds ? fmt(r.result_seconds) : r.race_date >= todayISO() ? 'J−' + daysUntil(r.race_date) : r.goal_seconds ? fmt(r.goal_seconds) : ''} />
  return <Page title="Courses" actions={<button className="icon-btn glass" onClick={() => setEdit(blank)} aria-label="Ajouter une course"><Icon name="plus" /></button>}>
    {teams.length > 0 && <Seg value={filter} onChange={setFilter} options={[['all', 'Toutes'], ...teams.map(t => [t.id, t.name]), ['solo', 'Solo']]} />}
    <Sec title="À venir" foot="Programmez autant de Hyrox que vous voulez, en solo ou avec chacun de vos duos. La plus proche alimente le compte à rebours ; l’objectif principal (A) pilote le programme d’entraînement.">
      {up.length ? <List>{up.map(item)}</List> : <div className="glass card"><Empty icon="flag">Aucune course prévue.<br /><button className="btn small" style={{ marginTop: 12 }} onClick={() => setEdit(blank)}>Ajouter une course</button></Empty></div>}
    </Sec>
    {past.length > 0 && <Sec title="Passées"><List>{past.map(item)}</List></Sec>}
    {edit && <RaceSheet race={edit} onClose={() => setEdit(null)} />}
  </Page>
}

function RaceSheet({ race, onClose }) {
  const { teams, profile, user, reload } = useApp(), toast = useToast()
  const [f, setF] = useState({ ...race, goal: race.goal_seconds ? fmt(race.goal_seconds) : '', result: race.result_seconds ? fmt(race.result_seconds) : '' })
  const [err, setErr] = useState('')
  const mine = activeTeams(teams, profile.id)
  const set = k => e => setF({ ...f, [k]: e.target ? e.target.value : e })
  const owner = !race.id || race.user_id === user.id
  async function save() {
    const g = parseT(f.goal), r = parseT(f.result)
    if (!f.name || !f.race_date) return setErr('Nom et date obligatoires')
    if (Number.isNaN(g) || Number.isNaN(r)) return setErr('Temps au format h:mm:ss')
    const row = { priority: f.priority || 'B', name: f.name, city: f.city, race_date: f.race_date, format: f.format, division: f.division, category: f.category, team_id: f.format === 'duo' ? (f.team_id || null) : null, goal_seconds: g, result_seconds: r, notes: f.notes || '' }
    if (race.id) row.id = race.id; else row.user_id = user.id
    try { await api.races.save(row); await reload(['races']); toast('Course enregistrée'); onClose() } catch (e) { setErr(e.message) }
  }
  async function del() { if (!confirm('Supprimer cette course ?')) return; await api.races.remove(race.id); await reload(['races']); onClose() }
  return <Sheet title={race.id ? 'Course' : 'Nouvelle course'} onClose={onClose} actions={<button className="btn plain" onClick={save}>OK</button>}>
    <Seg value={f.format} onChange={set('format')} options={[['solo', 'Solo'], ['duo', 'Duo']]} />
    <Seg value={f.division} onChange={set('division')} options={[['open', 'Open'], ['pro', 'Pro']]} />
    <Seg value={f.priority || 'B'} onChange={set('priority')} options={[['A', 'Objectif A'], ['B', 'Importante B'], ['C', 'Préparation C']]} />
    <List>
      <Field label="Nom"><input value={f.name} onChange={set('name')} placeholder="Hyrox Paris" /></Field>
      <Field label="Ville"><input value={f.city || ''} onChange={set('city')} placeholder="Paris" /></Field>
      <Field label="Date"><input type="date" value={f.race_date} onChange={set('race_date')} /></Field>
      <Field label="Catégorie"><select value={f.category || ''} onChange={set('category')}><option value="homme">Homme</option><option value="femme">Femme</option><option value="mixte">Mixte</option></select></Field>
      {f.format === 'duo' && <Field label="Équipe" sub={mine.length ? '' : 'Créez d’abord une équipe'}><select value={f.team_id || ''} onChange={set('team_id')}><option value="">—</option>{mine.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
      <Field label="Objectif" sub="h:mm:ss"><input inputMode="numeric" value={f.goal} onChange={set('goal')} placeholder="1:25:00" /></Field>
      <Field label="Résultat" sub="Après la course"><input inputMode="numeric" value={f.result} onChange={set('result')} placeholder="—" /></Field>
      <div className="row stack"><span className="small muted">Notes</span><textarea value={f.notes || ''} onChange={set('notes')} placeholder="Vague de départ, hôtel…" /></div>
    </List>
    {err && <p className="err">{err}</p>}
    <button className="btn block" style={{ marginTop: 14 }} onClick={save}>Enregistrer</button>
    {race.id && owner && <button className="btn plain block" style={{ marginTop: 6, color: 'var(--bad)' }} onClick={del}>Supprimer</button>}
  </Sheet>
}
