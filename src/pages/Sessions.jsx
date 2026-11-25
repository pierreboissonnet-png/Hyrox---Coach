import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Field, Seg, Empty, Icon, Sheet, useToast, Chips, TIME, parseNum, useLoad } from '../ui.jsx'
import { DeltaBars } from '../charts.jsx'
import { SEGS, STATIONS, fmt, fd, frDate, todayISO, tone, normPlan, parseT } from '../lib/hyrox.js'
import { emptyData, normData, split, pastData } from '../lib/session.js'
import { summary } from '../lib/analyze.js'
import { isCustom, customSummary, exLabel, isPlanned, isQuick, doneOf } from '../lib/custom.js'
import { QuickSheet } from './Activity.jsx'
import { TrainSheet } from './Train.jsx'
import { activeTeams, KIND, plansOf, knownUsers, isKeeperOnly, athleteNames, isAthlete } from './common.js'
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
  return <Page title="Séances" actions={<><button className="icon-btn glass" onClick={() => setTrain(true)} aria-label="Nouvelle séance"><Icon name="plus" /></button></>}>
    <div className="row-gap" style={{ marginBottom: 10, flexWrap: 'nowrap' }}><button className="btn" style={{ flex: 1 }} onClick={() => setTrain(true)}><Icon name="plus" size={18} />Nouvelle séance</button><a className="btn glass" href="#/comparer"><Icon name="compare" size={18} />Comparer</a></div>
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
  const { teams, profile, sessions } = useApp()
  const team = knownUsers(teams, profile.id)
  // Pointeurs déjà venus (code saisi une fois) : on les retrouve ici, plus besoin de code
  const pastIds = [...new Set(sessions.filter(s => s.timekeeper && s.timekeeper !== profile.id && (s.owner === profile.id || isAthlete(s, profile.id))).map(s => s.timekeeper))].filter(id => !team.some(p => p.id === id))
  const past = useLoad(() => api.profiles.many(pastIds), [pastIds.join()])
  const people = [...team.map(p => ({ ...p, why: 'Membre de l’un de vos duos (actuel ou ancien)' })), ...((past.data || []).map(p => ({ ...p, why: 'A déjà pointé vos temps : plus besoin de code' })))].filter(p => !exclude.includes(p.id))
  return <List>
    <Row title="Moi / les athlètes" sub="Vous pointez vous-même, ou votre partenaire de duo" chev={false} onClick={() => onChange(null)} value={value == null ? '✓' : ''} />
    {people.map(p => <Row key={p.id} icon="user" color="#30d158" title={p.display_name} sub={p.why} chev={false} onClick={() => onChange(p.id)} value={value === p.id ? '✓' : ''} />)}
    <div className="row"><span className="label"><span className="t">Quelqu’un d’autre</span><span className="s">Après la création, donnez-lui le code de pointage affiché sur l’écran Chrono : il le saisit dans Séances › Pointer un athlète.</span></span></div>
  </List>
}

export function NewSession() {
  const { teams, profile, user, reload } = useApp(), toast = useToast()
  const mine = activeTeams(teams, profile.id).filter(t => t.members.filter(m => !m.left_at).length === 2)
  const [f, setF] = useState({ format: mine.length ? 'duo' : 'solo', team: mine[0] ? mine[0].id : '', kind: 'entrainement', name: '', date: todayISO(), runKm: '', keeper: null })
  const [err, setErr] = useState('')
  const [mode, setMode] = useState(qs().get('apres') ? 'after' : 'live')   // chrono en direct ou saisie d'un Hyrox déjà fait
  const [P, setP] = useState({ t: {}, rox: '', total: '', rpe: 8, hr: '', start: '10:00', note: '' })
  const after = mode === 'after'
  const team = f.format === 'duo' ? mine.find(t => t.id === f.team) : null
  const plan = normPlan(team && team.plan)
  const athletes = team ? slotsOf(team) : { A: user.id, B: null }
  async function create() {
    setErr('')
    if (f.format === 'duo' && !team) return setErr('Choisissez votre duo (ou créez-en un dans Équipe).')
    let past = null
    if (after) {
      if (f.date > todayISO()) return setErr('La date doit être passée (ou aujourd’hui).')
      const T = {}; for (const g of SEGS.filter(g => g.type !== 'rox')) { const v = parseT(P.t[g.id]); if (v == null || Number.isNaN(v) || v <= 0) return setErr('Temps manquant ou invalide : ' + g.label + ' (format m:ss)'); T[g.id] = v }
      const rox = parseT(P.rox), total = parseT(P.total)
      if (Number.isNaN(rox) || Number.isNaN(total)) return setErr('Roxzone et temps total au format h:mm:ss ou m:ss')
      const hr = parseNum(P.hr); if (String(P.hr).trim() && (hr == null || hr < 60 || hr > 220)) return setErr('FC moyenne entre 60 et 220')
      past = pastData({ times: T, rox, total, runKm: +f.runKm || plan.runKm, date: f.date, start: P.start, rpe: P.rpe, avgHR: hr, note: P.note })
      if (past.error) return setErr(past.error)
    }
    try {
      const nm = w => w === 'A' && !team ? profile.display_name : team ? slotName(team, w) : null
      const keeperName = f.keeper ? (knownUsers(teams, profile.id).find(p => p.id === f.keeper) || {}).display_name : null
      const s = await api.sessions.save({
        owner: user.id, team_id: team ? team.id : null, kind: f.kind, session_date: f.date,
        name: f.name.trim() || (f.kind === 'course' ? 'Course' : f.kind === 'simulation' ? 'Simulation' : 'Entraînement') + (team ? ' duo' : ' solo') + ' du ' + frDate(f.date).slice(0, 5),
        athletes, data: past || emptyData(+f.runKm || plan.runKm), plan: team ? plan : null,
        names: { A: nm('A'), B: team ? nm('B') : null, ...(keeperName ? { keeper: keeperName } : {}) }, timekeeper: f.keeper,
      })
      await reload(['sessions']); toast(past ? 'Hyrox enregistré' : f.keeper ? `${keeperName} peut enregistrer vos temps` : 'Séance créée'); window.__hxReplace = true; location.replace('#/seance/' + s.id + (past ? '/stats' : '/chrono'))
    } catch (e) { setErr(e.message) }
  }
  return <Page back="#/seances" title={after ? 'Hyrox déjà fait' : 'Nouvelle séance'}>
    <List><Row icon="bolt" color="#bf5af2" title="Plutôt une séance personnalisée ?" sub="Renfo, circuits, EMOM, course, ateliers… avec vos objectifs" href="#/seance/specifique" /></List>
    <h2 className="sec">Chrono</h2>
    <Seg value={mode} onChange={v => { setMode(v); if (v === 'after' && f.kind === 'entrainement') setF({ ...f, kind: 'simulation' }) }} options={[['live', 'En direct'], ['after', 'Déjà fait : saisir les temps']]} />
    <h2 className="sec">Format</h2>
    <Seg value={f.format} onChange={v => setF({ ...f, format: v })} options={[['solo', 'Solo'], ['duo', 'Duo']]} />
    {f.format === 'duo' && (mine.length ? <List><Field label="Duo"><select value={f.team} onChange={e => setF({ ...f, team: e.target.value })}>{mine.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field></List>
      : <p className="note">Aucun duo complet : créez un duo et invitez votre partenaire dans l’onglet Équipe.</p>)}
    <h2 className="sec">Séance</h2>
    <Seg value={f.kind} onChange={v => setF({ ...f, kind: v })} options={[['entrainement', 'Entraînement'], ['simulation', 'Simulation'], ['course', 'Course']]} />
    <List>
      <Field label="Nom" sub="Facultatif"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Entraînement mardi" /></Field>
      <Field label="Date"><input type="date" value={f.date} max={after ? todayISO() : undefined} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
      {after && <Field label="Heure de départ" sub="Pour retrouver le cardio de la montre"><input type="time" value={P.start} onChange={e => setP({ ...P, start: e.target.value })} /></Field>}
      <Field label="Distance des courses" sub="km"><input type="number" step="0.05" value={f.runKm} onChange={e => setF({ ...f, runKm: e.target.value })} placeholder={String(plan.runKm).replace('.', ',')} /></Field>
    </List>
    {after ? <PastTimes P={P} setP={setP} /> : <>
    <h2 className="sec">Qui enregistre les temps ?</h2>
    <KeeperPicker value={f.keeper} onChange={k => setF({ ...f, keeper: k })} exclude={Object.values(athletes).filter(Boolean)} />
    <p className="foot">{team ? 'Le pointage suit la stratégie de relais du plan du duo. ' : 'En solo, pas de relais : on pointe la fin de chaque segment. '}Les temps arrivent en direct sur tous les téléphones. La personne qui pointe ne voit ni le cardio ni les données de santé.</p></>}
    {err && <p className="err">{err}</p>}
    <button className="btn block" style={{ marginTop: 16 }} onClick={create}>{after ? <><Icon name="check" size={18} />Enregistrer ce Hyrox</> : <><Icon name="play" size={18} />Ouvrir le chrono</>}</button>
  </Page>
}

/** Saisie après coup : 8 courses, 8 ateliers, Roxzone (ou temps total), ressenti */
function PastTimes({ P, setP }) {
  const set = (id, v) => setP(p => ({ ...p, t: { ...p.t, [id]: v } }))
  const sum = SEGS.filter(g => g.type !== 'rox').reduce((a, g) => { const v = parseT(P.t[g.id]); return v > 0 ? a + v : a }, 0)
  const rox = parseT(P.rox), total = parseT(P.total)
  const shown = total > 0 ? total : sum + (rox > 0 ? rox : 0)
  const inp = { ...TIME, style: { width: 84, textAlign: 'right' } }
  return <>
    <h2 className="sec">Temps de chaque segment</h2>
    <List>{STATIONS.map((st, k) => <React.Fragment key={st.id}>
      <Field label={'Course ' + (k + 1)}><input {...inp} defaultValue={P.t['r' + (k + 1)] || ''} onChange={e => set('r' + (k + 1), e.target.value)} aria-label={'Course ' + (k + 1)} /></Field>
      <Field label={st.label} sub={st.sub}><input {...inp} defaultValue={P.t[st.id] || ''} onChange={e => set(st.id, e.target.value)} aria-label={st.label} /></Field>
    </React.Fragment>)}</List>
    <List>
      <Field label="Roxzone (total)" sub="Facultatif si temps total"><input {...inp} placeholder="h:mm:ss" defaultValue={P.rox} onChange={e => setP({ ...P, rox: e.target.value })} /></Field>
      <Field label="Temps total" sub="Facultatif"><input {...inp} placeholder="h:mm:ss" defaultValue={P.total} onChange={e => setP({ ...P, total: e.target.value })} /></Field>
    </List>
    <p className="foot">Total : <b>{shown ? fmt(shown) : '—'}</b>. Sans Roxzone, elle est déduite du temps total (temps total − courses − ateliers) puis répartie sur les 15 transitions. Les résultats officiels Hyrox donnent tous ces temps.</p>
    <h2 className="sec">Ressenti</h2>
    <List>
      <div className="row stack"><div className="row-gap"><span>Effort ressenti</span><span className="spacer" /><b>{P.rpe}/10</b></div>
        <input type="range" min="1" max="10" value={P.rpe} onChange={e => setP({ ...P, rpe: +e.target.value })} aria-label="Effort ressenti" /></div>
      <Field label="FC moyenne" sub="Facultatif"><input inputMode="numeric" value={P.hr} onChange={e => setP({ ...P, hr: e.target.value })} placeholder="bpm" style={{ width: 84, textAlign: 'right' }} /></Field>
      <div className="row stack"><span className="small muted">Sensations</span><textarea value={P.note} onChange={e => setP({ ...P, note: e.target.value })} placeholder="Points forts, ateliers difficiles, gestion de l’effort…" /></div>
    </List>
  </>
}

/** Résumé par exercice d'une séance perso : temps, distance, répétitions, charge max */
function exStats(s) {
  const m = new Map()
  ;(s.data.steps || []).forEach(x => {
    const d = doneOf(x); if (![d.time, d.meters, d.reps, d.load, d.cal].some(v => v != null)) return
    const k = exLabel(x), o = m.get(k) || { time: 0, meters: 0, reps: 0, cal: 0, load: null, n: 0 }
    o.time += d.time || 0; o.meters += d.meters || 0; o.reps += d.reps || 0; o.cal += d.cal || 0; o.n++
    if (d.load != null) o.load = Math.max(o.load || 0, d.load)
    m.set(k, o)
  })
  return m
}
const exTxt = o => !o ? '—' : [o.meters ? (o.meters >= 1000 ? (o.meters / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(o.meters) + ' m') : '', o.reps ? o.reps + ' reps' : '', o.load ? o.load + ' kg' : '', o.cal ? o.cal + ' kcal' : '', o.time ? fmt(o.time) : ''].filter(Boolean).join(' · ') || '—'

export function Compare() {
  const { sessions, teams } = useApp()
  const plans = plansOf(teams)
  const q = qs(), pre = q.get('a') && sessions.find(s => s.id === q.get('a'))
  const [mode, setMode] = useState(pre && isCustom(pre) ? 'perso' : 'hyrox')
  const hy = sessions.filter(s => !isCustom(s) && !isQuick(s) && normData(s.data).cp.some(v => v != null))
  const cu = sessions.filter(s => isCustom(s) && !isPlanned(s) && !isQuick(s) && customSummary(s).done > 0)
  const done = mode === 'hyrox' ? hy : cu
  const [sel, setSel] = useState({})
  const defA = pre && done.includes(pre) ? pre.id : (done[1] || done[0] || {}).id || ''
  const a = sel[mode + 'a'] ?? defA, b = sel[mode + 'b'] ?? ((done.find(s => s.id !== a) || {}).id || '')
  const setA = v => setSel({ ...sel, [mode + 'a']: v }), setB = v => setSel({ ...sel, [mode + 'b']: v })
  const A = done.find(s => s.id === a), B = done.find(s => s.id === b)
  const rows = useMemo(() => {
    if (!A || !B || mode !== 'hyrox') return []
    const da = normData(A.data), db = normData(B.data)
    return SEGS.map((g, i) => ({ g, ta: split(da, i), tb: split(db, i) }))
  }, [A, B, mode])
  const sa = mode === 'hyrox' && A && summary(A, plans[A.team_id]), sb = mode === 'hyrox' && B && summary(B, plans[B.team_id])
  const ea = mode === 'perso' && A ? exStats(A) : null, eb = mode === 'perso' && B ? exStats(B) : null
  const exs = ea && eb ? [...new Set([...ea.keys(), ...eb.keys()])] : []
  const opt = s => <option key={s.id} value={s.id}>{frDate(s.session_date)} · {s.name}</option>
  return <Page back="#/seances" title="Comparer" subtitle="Deux séances côte à côte">
    <Seg value={mode} onChange={setMode} options={[['hyrox', 'Hyrox / simulations'], ['perso', 'Séances perso']]} />
    {done.length < 2 ? <div className="glass card"><Empty icon="compare">Il faut au moins deux {mode === 'hyrox' ? 'séances Hyrox avec des temps' : 'séances perso réalisées'} pour comparer.</Empty></div> : <>
    <List>
      <Field label="Séance 1"><select style={{ width: '72%', direction: 'ltr' }} value={a} onChange={e => setA(e.target.value)}>{done.map(opt)}</select></Field>
      <Field label="Séance 2"><select style={{ width: '72%', direction: 'ltr' }} value={b} onChange={e => setB(e.target.value)}>{done.map(opt)}</select></Field>
    </List>
    {mode === 'hyrox' && A && B && <>
      <h2 className="sec">Écart (séance 2 − séance 1)</h2>
      <div className="glass card"><DeltaBars rows={sa.stations.map((x, i) => ({ label: x.label, d: x.t != null && sb.stations[i].t != null ? sb.stations[i].t - x.t : null }))} /></div>
      <div className="glass card scroll-x"><table className="tbl"><thead><tr><th>Segment</th><th className="r">1</th><th className="r">2</th><th className="r">Écart</th></tr></thead><tbody>
        {rows.map(({ g, ta, tb }) => <tr key={g.id} className={g.type}><td>{g.label}</td><td className="r num">{fmt(ta)}</td><td className="r num">{fmt(tb)}</td><td className={'r num ' + tone(ta != null && tb != null ? tb - ta : null)}>{ta != null && tb != null ? fd(tb - ta) : '—'}</td></tr>)}
        <tr className="st"><td>Total</td><td className="r num">{fmt(sa.all.t)}</td><td className="r num">{fmt(sb.all.t)}</td><td className={'r num ' + tone(sb.all.t - sa.all.t)}>{fd(sb.all.t - sa.all.t)}</td></tr>
      </tbody></table></div>
    </>}
    {mode === 'perso' && A && B && <>
      <div className="stats">{[A, B].map((s, k) => { const c = customSummary(s); return <div className="stat glass" key={k}><div className="k">Séance {k + 1}</div><div className="v num">{fmt(c.work)}</div><div className="d">{c.done}/{c.n} étapes · {c.achievement != null ? Math.round(c.achievement * 100) + ' % des objectifs' : 'sans objectif'}</div></div> })}</div>
      <h2 className="sec">Par exercice</h2>
      <List>{exs.map(k => { const x = ea.get(k), y = eb.get(k), dl = x && y && x.load && y.load ? y.load - x.load : null, dt = x && y && x.time && y.time && x.meters === y.meters && x.reps === y.reps ? y.time - x.time : null
        return <div className="row stack" key={k}><b>{k}</b>
          <div className="small" style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: '2px 6px' }}><span className="muted">1</span><span className="num">{exTxt(x)}</span><span className="muted">2</span><span className="num">{exTxt(y)}</span></div>
          {(dl || dt) ? <span className="small">{dl ? <span className={dl > 0 ? 'good' : 'bad'}>{dl > 0 ? '+' : ''}{dl} kg </span> : ''}{dt ? <span className={tone(dt)}>{fd(dt)} sur le même volume</span> : ''}</span> : null}
        </div> })}</List>
      <p className="foot">Charge : la plus lourde de l’exercice. Temps, distance et répétitions : cumul des séries.</p>
    </>}
    </>}
  </Page>
}
