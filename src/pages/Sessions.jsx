import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Field, Seg, Empty, Icon, Sheet, useToast, Chips } from '../ui.jsx'
import { DeltaBars } from '../charts.jsx'
import { SEGS, fmt, fd, frDate, todayISO, tone, normPlan } from '../lib/hyrox.js'
import { emptyData, normData, split } from '../lib/session.js'
import { summary } from '../lib/analyze.js'
import { isCustom, customSummary, exLabel, isPlanned, isQuick } from '../lib/custom.js'
import { QuickSheet } from './Activity.jsx'
import { TrainSheet } from './Train.jsx'
import { activeTeams, KIND, plansOf, knownUsers, isKeeperOnly, athleteNames } from './common.js'
import { slotsOf, slotName } from './Teams.jsx'

const tomorrow = () => { const d = new Date(Date.now() + 864e5); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }
const qs = () => new URLSearchParams((location.hash.split('?')[1]) || '')

export function Sessions() {
  const { sessions, teams, loaded, profile } = useApp()
  const [team, setTeam] = useState(qs().get('team') || 'all')
  const [claim, setClaim] = useState(false), [quick, setQuick] = useState(false), [train, setTrain] = useState(false)
  const plans = plansOf(teams)
  const keep = sessions.filter(s => isKeeperOnly(s, profile.id, teams))
  const mine = sessions.filter(s => !keep.includes(s))
  const planned = mine.filter(s => isPlanned(s) && s.session_date >= todayISO()).sort((a, b) => a.session_date.localeCompare(b.session_date))
  const list = mine.filter(s => !planned.includes(s)).filter(s => team === 'all' || (team === 'solo' ? !s.team_id : s.team_id === team))
  const opts = [['all', 'Toutes'], ...teams.map(t => [t.id, t.name]), ['solo', 'Solo']]
  const row = (s, k) => {
    if (isQuick(s)) { const c = customSummary(s), st = c.steps[0] || {}, dn = (st.done || {}); return <Row key={s.id} icon="heart" color="#ff9f0a" title={s.name}
      sub={`${frDate(s.session_date)} · ${s.data.auto ? 'montre' : 'activité'} · ${Math.round(c.total / 60)} min${dn.meters ? ' · ' + String(Math.round(dn.meters / 100) / 10).replace('.', ',') + ' km' : ''}${dn.rpe ? ' · effort ' + dn.rpe + '/10' : ''}`} href={'#/seance/' + s.id + '/temps'} /> }
    if (isCustom(s)) { const c = customSummary(s), pl = isPlanned(s); return <Row key={s.id} icon={pl ? 'cal' : 'bolt'} color={k ? '#30d158' : pl ? '#8e8e93' : '#bf5af2'} title={k ? 'Pointage · ' + (athleteNames(s) || s.name) : s.name}
      sub={`${frDate(s.session_date)} · ${pl ? (s.session_date < todayISO() ? 'prévue, non réalisée' : 'prévue') : 'personnalisée'} · ${[...new Set(c.steps.map(exLabel))].slice(0, 3).join(', ')}${c.complete || pl ? '' : ` · ${c.done}/${c.n}`}`}
      value={c.achievement != null ? Math.round(c.achievement * 100) + ' %' : ''} href={'#/seance/' + s.id + (k ? '/chrono' : '')} /> }
    const sum = summary(s, s.plan || plans[s.team_id]), done = sum.d.cp.filter(v => v != null).length
    return <Row key={s.id} icon={k ? 'timer' : s.kind === 'course' ? 'flag' : 'timer'} color={k ? '#30d158' : s.kind === 'course' ? '#ff9f0a' : s.kind === 'simulation' ? '#5e5ce6' : '#0a84ff'} title={k ? 'Pointage · ' + (athleteNames(s) || s.name) : s.name}
      sub={`${frDate(s.session_date)} · ${KIND[s.kind]}${s.team_id ? ' · duo' : ' · solo'}${sum.complete ? '' : ` · ${done}/${SEGS.length}`}${!k && s.timekeeper && s.timekeeper !== profile.id ? ' · pointée par ' + ((s.names && s.names.keeper) || 'un tiers') : ''}`}
      value={sum.all.n ? fmt(sum.all.t) : ''} href={'#/seance/' + s.id + (k ? '/chrono' : '')} />
  }
  return <Page title="Séances" actions={<><a className="icon-btn glass" href="#/comparer" aria-label="Comparer"><Icon name="compare" /></a><button className="icon-btn glass" onClick={() => setTrain(true)} aria-label="Nouvelle séance"><Icon name="plus" /></button></>}>
    <button className="btn block" style={{ marginBottom: 10 }} onClick={() => setTrain(true)}><Icon name="plus" size={18} />Nouvelle séance ou activité</button>
    {planned.length > 0 && <Sec title="Prévues"><List>{planned.map(s => <Row key={s.id} icon="cal" color="#5e5ce6" title={s.name} sub={`${s.session_date === todayISO() ? 'Aujourd’hui' : frDate(s.session_date)} · ${[...new Set(customSummary(s).steps.map(exLabel))].slice(0, 3).join(', ')}`} value={s.session_date === todayISO() ? 'Lancer' : ''} href={'#/seance/' + s.id + '/chrono'} />)}</List></Sec>}
    {keep.length > 0 && <Sec title="Séances que je pointe"><List>{keep.map(s => row(s, true))}</List></Sec>}
    {opts.length > 2 && <Chips value={team} onChange={setTeam} label="Filtrer" options={opts} />}
    {!loaded ? <p className="muted">Chargement…</p> : list.length ? <List>{list.map(s => row(s, false))}</List> : <div className="glass card"><Empty icon="timer">Aucune séance.</Empty></div>}
    {claim && <ClaimSheet onClose={() => setClaim(false)} />}
    {quick && <QuickSheet onClose={() => setQuick(false)} />}
    {train && <TrainSheet onClose={() => setTrain(false)} />}
  </Page>
}

/** Devenir pointeur d'une séance avec le code donné par l'athlète */
export function ClaimSheet({ onClose }) {
  const { reload } = useApp(), toast = useToast()
  const [code, setCode] = useState(''), [err, setErr] = useState('')
  async function go() {
    try { const id = await api.sessions.claim(code); await reload(['sessions']); toast('Vous enregistrez les temps de cette séance'); onClose(); location.hash = '#/seance/' + id + '/chrono' }
    catch (e) { setErr(/inconnu/i.test(e.message) ? 'Code de pointage inconnu' : e.message) }
  }
  return <Sheet title="Pointer un athlète" onClose={onClose}>
    <p className="small muted" style={{ marginTop: 0 }}>Saisissez le code de pointage affiché sur le téléphone de l’athlète (écran Chrono de sa séance). Vous pourrez enregistrer ses temps ; vous ne verrez ni son cardio ni ses données de santé.</p>
    <List><Field label="Code"><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="AB12CD" autoCapitalize="characters" autoFocus /></Field></List>
    {err && <p className="err">{err}</p>}
    <button className="btn block" style={{ marginTop: 14 }} disabled={code.trim().length < 4} onClick={go}>Ouvrir le chrono</button>
  </Sheet>
}

/** Choix de la personne qui enregistre les temps */
export function KeeperPicker({ value, onChange, exclude = [] }) {
  const { teams, profile } = useApp()
  const people = knownUsers(teams, profile.id).filter(p => !exclude.includes(p.id))
  return <List>
    <Row title="Moi / les athlètes" sub="Vous pointez vous-même, ou votre partenaire de duo" chev={false} onClick={() => onChange(null)} value={value == null ? '✓' : ''} />
    {people.map(p => <Row key={p.id} icon="user" color="#30d158" title={p.display_name} sub="Membre de l’un de vos duos (actuel ou ancien)" chev={false} onClick={() => onChange(p.id)} value={value === p.id ? '✓' : ''} />)}
    <div className="row"><span className="label"><span className="t">Quelqu’un d’autre</span><span className="s">Après la création, donnez-lui le code de pointage affiché sur l’écran Chrono : il le saisit dans Séances › Pointer un athlète.</span></span></div>
  </List>
}

export function NewSession() {
  const { teams, profile, user, reload } = useApp(), toast = useToast()
  const mine = activeTeams(teams, profile.id).filter(t => t.members.filter(m => !m.left_at).length === 2)
  const [f, setF] = useState({ format: mine.length ? 'duo' : 'solo', team: mine[0] ? mine[0].id : '', kind: 'entrainement', name: '', date: todayISO(), runKm: '', keeper: null })
  const [err, setErr] = useState('')
  const team = f.format === 'duo' ? mine.find(t => t.id === f.team) : null
  const plan = normPlan(team && team.plan)
  const athletes = team ? slotsOf(team) : { A: user.id, B: null }
  async function create() {
    setErr('')
    if (f.format === 'duo' && !team) return setErr('Choisissez votre duo (ou créez-en un dans Équipe).')
    try {
      const nm = w => w === 'A' && !team ? profile.display_name : team ? slotName(team, w) : null
      const keeperName = f.keeper ? (knownUsers(teams, profile.id).find(p => p.id === f.keeper) || {}).display_name : null
      const s = await api.sessions.save({
        owner: user.id, team_id: team ? team.id : null, kind: f.kind, session_date: f.date,
        name: f.name.trim() || (f.kind === 'course' ? 'Course' : f.kind === 'simulation' ? 'Simulation' : 'Entraînement') + (team ? ' duo' : ' solo') + ' du ' + frDate(f.date).slice(0, 5),
        athletes, data: emptyData(+f.runKm || plan.runKm), plan: team ? plan : null,
        names: { A: nm('A'), B: team ? nm('B') : null, ...(keeperName ? { keeper: keeperName } : {}) }, timekeeper: f.keeper,
      })
      await reload(['sessions']); toast(f.keeper ? `${keeperName} peut enregistrer vos temps` : 'Séance créée'); window.__hxReplace = true; location.replace('#/seance/' + s.id + '/chrono')
    } catch (e) { setErr(e.message) }
  }
  return <Page back="#/seances" title="Nouvelle séance">
    <List><Row icon="bolt" color="#bf5af2" title="Plutôt une séance personnalisée ?" sub="Renfo, circuits, EMOM, course, ateliers… avec vos objectifs" href="#/seance/specifique" /></List>
    <h2 className="sec">Format</h2>
    <Seg value={f.format} onChange={v => setF({ ...f, format: v })} options={[['solo', 'Solo'], ['duo', 'Duo']]} />
    {f.format === 'duo' && (mine.length ? <List><Field label="Duo"><select value={f.team} onChange={e => setF({ ...f, team: e.target.value })}>{mine.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field></List>
      : <p className="note">Aucun duo complet : créez un duo et invitez votre partenaire dans l’onglet Équipe.</p>)}
    <h2 className="sec">Séance</h2>
    <Seg value={f.kind} onChange={v => setF({ ...f, kind: v })} options={[['entrainement', 'Entraînement'], ['simulation', 'Simulation'], ['course', 'Course']]} />
    <List>
      <Field label="Nom" sub="Facultatif"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Entraînement mardi" /></Field>
      <Field label="Date"><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
      <Field label="Distance des courses" sub="km"><input type="number" step="0.05" value={f.runKm} onChange={e => setF({ ...f, runKm: e.target.value })} placeholder={String(plan.runKm).replace('.', ',')} /></Field>
    </List>
    <h2 className="sec">Qui enregistre les temps ?</h2>
    <KeeperPicker value={f.keeper} onChange={k => setF({ ...f, keeper: k })} exclude={Object.values(athletes).filter(Boolean)} />
    <p className="foot">{team ? 'Le pointage suit la stratégie de relais du plan du duo. ' : 'En solo, pas de relais : on pointe la fin de chaque segment. '}Les temps arrivent en direct sur tous les téléphones. La personne qui pointe ne voit ni le cardio ni les données de santé.</p>
    {err && <p className="err">{err}</p>}
    <button className="btn block" style={{ marginTop: 16 }} onClick={create}><Icon name="play" size={18} />Ouvrir le chrono</button>
  </Page>
}

export function Compare() {
  const { sessions, teams } = useApp()
  const plans = plansOf(teams)
  const done = sessions.filter(s => !isCustom(s) && normData(s.data).cp.some(v => v != null))
  const [a, setA] = useState(done[1] ? done[1].id : ''), [b, setB] = useState(done[0] ? done[0].id : '')
  const A = done.find(s => s.id === a), B = done.find(s => s.id === b)
  const rows = useMemo(() => {
    if (!A || !B) return []
    const da = normData(A.data), db = normData(B.data)
    return SEGS.map((g, i) => ({ g, ta: split(da, i), tb: split(db, i) }))
  }, [A, B])
  const sa = A && summary(A, plans[A.team_id]), sb = B && summary(B, plans[B.team_id])
  return <Page back="#/seances" title="Comparer">
    <List>
      <Field label="Séance 1"><select style={{ width: '72%', direction: 'ltr' }} value={a} onChange={e => setA(e.target.value)}>{done.map(s => <option key={s.id} value={s.id}>{frDate(s.session_date)} · {s.name}</option>)}</select></Field>
      <Field label="Séance 2"><select style={{ width: '72%', direction: 'ltr' }} value={b} onChange={e => setB(e.target.value)}>{done.map(s => <option key={s.id} value={s.id}>{frDate(s.session_date)} · {s.name}</option>)}</select></Field>
    </List>
    {A && B && <>
      <h2 className="sec">Écart (séance 2 − séance 1)</h2>
      <div className="glass card"><DeltaBars rows={sa.stations.map((x, i) => ({ label: x.label, d: x.t != null && sb.stations[i].t != null ? sb.stations[i].t - x.t : null }))} /></div>
      <div className="glass card scroll-x"><table className="tbl"><thead><tr><th>Segment</th><th className="r">1</th><th className="r">2</th><th className="r">Écart</th></tr></thead><tbody>
        {rows.map(({ g, ta, tb }) => <tr key={g.id} className={g.type}><td>{g.label}</td><td className="r num">{fmt(ta)}</td><td className="r num">{fmt(tb)}</td><td className={'r num ' + tone(ta != null && tb != null ? tb - ta : null)}>{ta != null && tb != null ? fd(tb - ta) : '—'}</td></tr>)}
        <tr className="st"><td>Total</td><td className="r num">{fmt(sa.all.t)}</td><td className="r num">{fmt(sb.all.t)}</td><td className={'r num ' + tone(sb.all.t - sa.all.t)}>{fd(sb.all.t - sa.all.t)}</td></tr>
      </tbody></table></div>
    </>}
  </Page>
}
