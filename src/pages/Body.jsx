// Douleurs (Santé) et banque d'étirements avec lecteur minuté.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Field, Seg, Sheet, Empty, Icon, useToast, useLoad, Chips } from '../ui.jsx'
import { todayISO, frDate, fmt } from '../lib/hyrox.js'
import { EXERCISES } from '../lib/custom.js'
import { ZONES, ZONE, WHEN, ADVICE, isActive, redFlags, PAIN_RULE, hits, altFor } from '../lib/pain.js'
import { STRETCHES, ROUTINES, ROUTINE, STRETCH, routineSec, playSteps, forZone, suggestRoutine } from '../lib/stretch.js'
import { quickSession } from '../lib/activity.js'
import { Pose } from './Pose.jsx'

// ---------------------------------------------------------------- douleurs
export function Pains() {
  const j = useLoad(() => api.journal.list('pain'), []), toast = useToast()
  const [open, setOpen] = useState(false)
  const all = j.data || [], act = all.filter(isActive), old = all.filter(p => !isActive(p))
  async function resolve(p) { try { await api.journal.update(p.id, { data: { ...p.data, status: 'resolved', resolvedOn: todayISO() } }); j.reload(); toast('Douleur marquée comme passée') } catch (e) { toast(e.message) } }
  async function level(p, v) { try { await api.journal.update(p.id, { data: { ...p.data, level: v, history: [...(p.data.history || []), { day: todayISO(), level: v }].slice(-30) } }); j.reload() } catch (e) { toast(e.message) } }
  return <>
    <div className="note small" style={{ marginTop: 0 }}>L’app ne pose pas de diagnostic. Elle vous indique les mouvements qui sollicitent la zone, adapte le programme et vous dit quand consulter un médecin ou un kiné.</div>
    <button className="btn block" onClick={() => setOpen(true)}><Icon name="plus" size={18} />Déclarer une douleur</button>
    {act.length === 0 && <div className="glass card" style={{ marginTop: 12 }}><Empty icon="heart">Aucune douleur en cours.</Empty></div>}
    {act.length > 0 && <div className="row-gap" style={{ marginTop: 10 }}><a className="btn glass small" style={{ flex: 1 }} href="#/moi/programme"><Icon name="cal" size={14} />Programme adapté</a><a className="btn glass small" style={{ flex: 1 }} href="#/moi/etirements"><Icon name="leaf" size={14} />Étirements</a></div>}
    {act.map(p => <PainCard key={p.id} p={p} onResolve={() => resolve(p)} onLevel={v => level(p, v)} />)}
    {old.length > 0 && <Sec title="Douleurs passées"><List>{old.map(p => <Row key={p.id} title={ZONE[p.data.zone] + (p.data.side ? ' ' + p.data.side : '')} sub={`${frDate(p.data.since || p.day)} → ${p.data.resolvedOn ? frDate(p.data.resolvedOn) : '?'} · max ${p.data.level}/10`}>
      <button className="icon-btn" aria-label="Supprimer" onClick={async () => { if (confirm('Supprimer ?')) { await api.journal.remove(p.id); j.reload() } }}><Icon name="trash" size={16} /></button></Row>)}</List></Sec>}
    <p className="foot">{PAIN_RULE}</p>
    {open && <PainSheet onClose={ok => { setOpen(false); if (ok) j.reload() }} />}
  </>
}
function PainCard({ p, onResolve, onLevel }) {
  const d = p.data, A = ADVICE[d.zone] || {}, flags = redFlags(p)
  const affected = EXERCISES.filter(e => hits(e.id, [d.zone]).length && e.cat !== 'sport' && e.cat !== 'fmt')
  const [more, setMore] = useState(false)
  return <div className="glass card" style={{ marginTop: 12 }}>
    <div className="row-gap"><b>{ZONE[d.zone]}{d.side ? ' · ' + d.side : ''}</b><span className="spacer" /><span className={'badge ' + (d.level >= 7 ? 'bad' : d.level >= 4 ? 'warn' : '')}>{d.level}/10</span></div>
    <div className="small muted">Depuis le {frDate(d.since || p.day)}{(d.when || []).length ? ' · ' + d.when.map(w => (WHEN.find(x => x[0] === w) || [])[1]).filter(Boolean).join(', ').toLowerCase() : ''}{d.note ? ' · ' + d.note : ''}</div>
    {flags.length > 0 && <div className="note small" style={{ borderColor: 'var(--bad)' }}>{flags.map((f, i) => <div key={i}>⚠ {f}</div>)}</div>}
    <div className="tip"><span className="dot bad" /><span className="small"><b>À éviter tant que ça fait mal :</b> {(A.avoid || []).join(' ; ')}.</span></div>
    <div className="tip"><span className="dot warn" /><span className="small"><b>À adapter :</b> {(A.adapt || []).join(' ; ')}.</span></div>
    <div className="tip"><span className="dot good" /><span className="small"><b>En général bien toléré, si indolore :</b> {(A.ok || []).join(' ; ')}.</span></div>
    <button className="btn plain small" onClick={() => setMore(m => !m)}>{more ? 'Masquer' : 'Voir'} les exercices concernés ({affected.length}) et les étirements doux</button>
    {more && <>
      <div className="small" style={{ margin: '6px 0' }}>{affected.map(e => { const a = altFor(e.id, [d.zone]); return <div key={e.id}>• {e.label}{a ? <span className="muted"> → {EXERCISES.find(x => x.id === a).label}</span> : ''}</div> })}</div>
      <div className="small"><b>Étirements doux</b> (seulement s’ils n’augmentent pas la douleur) : {forZone(d.zone).map(s => s.name).join(', ') || '—'}. <a className="link" href="#/moi/etirements">Banque d’étirements →</a></div>
    </>}
    <div className="row stack" style={{ padding: '8px 0 0' }}><div className="row-gap small"><span>Aujourd’hui</span><span className="spacer" /><b>{d.level}/10</b></div>
      <input type="range" min="0" max="10" defaultValue={d.level} onMouseUp={e => +e.target.value !== d.level && onLevel(+e.target.value)} onTouchEnd={e => +e.target.value !== d.level && onLevel(+e.target.value)} onKeyUp={e => +e.target.value !== d.level && onLevel(+e.target.value)} aria-label="Intensité aujourd’hui" /></div>
    <div className="row-gap" style={{ marginTop: 8 }}><span className="small muted">Le programme et les séances évitent automatiquement ces mouvements.</span><span className="spacer" /><button className="btn tinted small" onClick={onResolve}>C’est passé</button></div>
  </div>
}
function PainSheet({ onClose }) {
  const toast = useToast()
  const [f, setF] = useState({ zone: 'genou', side: '', level: 3, since: todayISO(), when: ['effort'], swelling: false, numb: false, trauma: false, note: '' })
  async function save() {
    try { await api.journal.add({ kind: 'pain', day: todayISO(), data: { ...f, status: 'active', history: [{ day: todayISO(), level: f.level }] } }); toast('Douleur enregistrée : programme adapté'); onClose(true) }
    catch (e) { toast('Enregistrement impossible : ' + e.message) }
  }
  const tg = w => setF({ ...f, when: f.when.includes(w) ? f.when.filter(x => x !== w) : [...f.when, w] })
  return <Sheet title="Déclarer une douleur" onClose={() => onClose(false)} footer={<button className="btn block" onClick={save}>Enregistrer</button>}>
    <List>
      <Field label="Zone"><select value={f.zone} onChange={e => setF({ ...f, zone: e.target.value })}>{ZONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Côté"><select value={f.side} onChange={e => setF({ ...f, side: e.target.value })}><option value="">—</option><option value="gauche">Gauche</option><option value="droit">Droit</option><option value="des deux côtés">Les deux</option></select></Field>
      <div className="row stack"><div className="row-gap"><span>Intensité</span><span className="spacer" /><b>{f.level}/10</b><span className="small muted">{f.level <= 3 ? 'gêne' : f.level <= 6 ? 'modérée' : 'forte'}</span></div><input type="range" min="0" max="10" value={f.level} onChange={e => setF({ ...f, level: +e.target.value })} aria-label="Intensité" /></div>
      <Field label="Depuis le"><input type="date" value={f.since} max={todayISO()} onChange={e => setF({ ...f, since: e.target.value })} /></Field>
      <div className="row stack"><span className="small">Quand ?</span><div className="row-gap" style={{ flexWrap: 'wrap', gap: 6 }}>{WHEN.map(([k, l]) => <button key={k} className={'btn small ' + (f.when.includes(k) ? '' : 'glass')} aria-pressed={f.when.includes(k)} onClick={() => tg(k)}>{l}</button>)}</div></div>
      {[['trauma', 'Après une chute, un choc ou un craquement'], ['swelling', 'Gonflement, chaleur ou rougeur'], ['numb', 'Fourmillements, engourdissement, perte de force']].map(([k, l]) => <label key={k} className="row"><span className="label"><span className="t small">{l}</span></span><input type="checkbox" checked={f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} style={{ width: 22, height: 22 }} /></label>)}
      <div className="row stack"><span className="small muted">Note</span><textarea value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Ex. en descente, après les fentes…" /></div>
    </List>
    <p className="foot">Ces informations restent privées. En cas de doute, ou si la douleur persiste, consultez un médecin ou un kiné.</p>
  </Sheet>
}

// ---------------------------------------------------------------- étirements
export function StretchPage() {
  const asked = new URLSearchParams(location.hash.split('?')[1] || '').get('r')
  const [zone, setZone] = useState('all'), [play, setPlay] = useState(asked && ROUTINE[asked] ? ROUTINE[asked] : null), [openId, setOpenId] = useState(null)
  const list = STRETCHES.filter(s => zone === 'all' || s.zones.includes(zone))
  const zonesUsed = ZONES.filter(([k]) => STRETCHES.some(s => s.zones.includes(k)))
  return <Page back="#/moi" title="Étirements" subtitle="Routines minutées et banque de positions. Sans douleur, respiration lente, pas d’à-coups.">
    <Sec title="Séances longues" foot="Pour les jours sans renfo ou de repos : choisissez la durée. Validez chaque position avec « Fait ✓ » et enregistrez la séance à la fin : elle compte dans votre semaine."><List>{ROUTINES.filter(r => r.long).map(r => <Row key={r.id} icon="leaf" color="#64d2ff" title={r.name} sub={r.desc} value={Math.round(routineSec(r.items, r.mult) / 60) + ' min'} onClick={() => setPlay(r)} />)}</List></Sec>
    <Sec title="Routines courtes"><List>{ROUTINES.filter(r => !r.long).map(r => <Row key={r.id} icon="play" color="#30d158" title={r.name} sub={r.desc} value={Math.round(routineSec(r.items) / 60) + ' min'} onClick={() => setPlay(r)} />)}</List></Sec>
    <h2 className="sec">Banque</h2>
    <Chips value={zone} onChange={setZone} label="Zones" options={[['all', 'Tout'], ...zonesUsed]} />
    <List>{list.map(s => <React.Fragment key={s.id}><Row title={s.name} sub={s.zones.map(z => ZONE[z]).join(', ') + (s.dyn ? ' · mobilité' : s.roll ? ' · rouleau' : '')} value={s.sec + ' s' + (s.side ? ' ×2' : '')} onClick={() => setOpenId(openId === s.id ? null : s.id)} />
      {openId === s.id && <div className="row stack" style={{ background: 'var(--fill)' }}><div style={{ alignSelf: 'center' }}><Pose id={s.id} size={170} /></div><span className="small">{s.how}</span><button className="btn tinted small" style={{ alignSelf: 'flex-start' }} onClick={() => setPlay({ id: s.id, name: s.name, items: [s.id] })}><Icon name="play" size={14} />Minuter</button></div>}
    </React.Fragment>)}</List>
    <p className="foot">Étirements statiques plutôt après l’effort ; avant, préférez la mobilité (mouvements lents). En cas de douleur, arrêtez et voyez Santé › Douleurs.</p>
    {play && <Player routine={play} onClose={() => setPlay(null)} />}
  </Page>
}
function Player({ routine, onClose }) {
  const { user, reload } = useApp(), toast = useToast()
  const steps = useMemo(() => playSteps(routine.items, routine.mult || 1), [routine])
  const [i, setI] = useState(0), [left, setLeft] = useState(steps[0] ? steps[0].sec : 0), [run, setRun] = useState(false), [prep, setPrep] = useState(5)
  const [doneSet, setDoneSet] = useState(() => new Set()), [saved, setSaved] = useState(false)
  const st = steps[i]
  const tick = useRef(null)
  const markDone = k => setDoneSet(S => { const n = new Set(S); n.add(k); return n })
  tick.current = () => {
    if (prep > 0) return setPrep(prep - 1)
    if (left > 1) return setLeft(left - 1)
    try { navigator.vibrate && navigator.vibrate(150) } catch {}
    markDone(i)
    if (i + 1 < steps.length) { setI(i + 1); setLeft(steps[i + 1].sec); setPrep(5) } else { setLeft(0); setRun(false) }
  }
  useEffect(() => { if (!run) return; const t = setInterval(() => tick.current(), 1000); return () => clearInterval(t) }, [run])
  const go = k => { if (k < 0 || k >= steps.length) return; setI(k); setLeft(steps[k].sec); setPrep(5) }
  // « Fait ✓ » : la position est validée, on passe à la suivante sans attendre la fin du minuteur
  function validate() {
    markDone(i); try { navigator.vibrate && navigator.vibrate(60) } catch {}
    if (i + 1 < steps.length) { setI(i + 1); setLeft(steps[i + 1].sec); setPrep(run ? 5 : 0) } else { setLeft(0); setRun(false) }
  }
  const done = !run && i === steps.length - 1 && left === 0
  const secDone = [...doneSet].reduce((a, k) => a + (steps[k] ? steps[k].sec + 5 : 0), 0)
  async function save() {
    try {
      const minutes = Math.max(1, Math.round(secDone / 60))
      const q = quickSession({ uid: user.id, name: 'Étirements · ' + routine.name, ex: 'mobility', date: todayISO(), minutes, rpe: 2, note: doneSet.size + '/' + steps.length + ' positions' })
      q.name = 'Étirements · ' + routine.name; q.data.title = q.name; q.data.stretch = { routine: routine.id, done: doneSet.size, of: steps.length }
      await api.sessions.save(q); await reload(['sessions']); setSaved(true); toast('Séance d’étirements enregistrée (' + minutes + ' min) : elle compte dans votre semaine')
    } catch (e) { toast('Enregistrement impossible : ' + e.message) }
  }
  return <Sheet title={routine.name} onClose={onClose} footer={<div className="row-gap" style={{ flexWrap: 'nowrap' }}>
    <button className="btn glass" onClick={() => go(i - 1)} disabled={i === 0}>Précédent</button>
    <button className="btn" style={{ flex: 1 }} onClick={() => done ? (go(0), setDoneSet(new Set()), setSaved(false), setRun(true)) : setRun(r => !r)}>{done ? 'Recommencer' : run ? 'Pause' : i === 0 && left === steps[0].sec ? 'Démarrer' : 'Reprendre'}</button>
    <button className="btn glass" onClick={() => go(i + 1)} disabled={i >= steps.length - 1}>Suivant</button></div>}>
    {st && <div className="center">
      <div className="row-gap" style={{ justifyContent: 'center' }}><span className="small muted">{i + 1}/{steps.length}</span><span className="small" style={{ color: 'var(--good)' }}>{doneSet.size ? '· ' + doneSet.size + ' faite(s) ✓' : ''}</span></div>
      <div style={{ height: 6, background: 'var(--fill)', borderRadius: 99, margin: '6px 0' }}><div style={{ height: '100%', width: (doneSet.size / steps.length * 100) + '%', background: 'var(--good)', borderRadius: 99, transition: 'width .3s' }} /></div>
      {!done && <div style={{ display: 'flex', justifyContent: 'center' }}><Pose id={st.id} size={180} /></div>}
      <h2 style={{ margin: '4px 0' }}>{done ? 'Séance terminée' : st.name}{!done && st.sideLabel ? <span className="muted small"> · {st.sideLabel}</span> : ''}</h2>
      <div className="clock num" style={{ fontSize: 56 }}>{done ? '✓' : run && prep > 0 ? prep : fmt(left)}</div>
      {!done && <div className="small muted">{run && prep > 0 ? 'Mise en place…' : st.dyn ? 'Mouvement lent et contrôlé' : st.roll ? 'Roulez lentement' : 'Tenez, respirez lentement'}</div>}
      {!done && <button className={'btn ' + (doneSet.has(i) ? 'glass' : 'tinted')} style={{ margin: '10px auto 4px', minWidth: 180 }} onClick={validate}>{doneSet.has(i) ? 'Déjà faite ✓ · suivante' : 'Fait ✓'}</button>}
      {!done && <p className="small" style={{ textAlign: 'left' }}>{st.how}</p>}
      {!done && steps[i + 1] && <div className="tiny muted">Ensuite : {steps[i + 1].name}{steps[i + 1].sideLabel ? ' (' + steps[i + 1].sideLabel + ')' : ''}</div>}
      {(done || doneSet.size > 0) && <div className="glass card" style={{ textAlign: 'left', marginTop: 10 }}>
        <b>{saved ? 'Séance enregistrée ✓' : 'Compter cette séance dans ma semaine'}</b>
        <div className="small muted">{doneSet.size}/{steps.length} positions validées · environ {Math.max(1, Math.round(secDone / 60))} min. Elle apparaît dans vos séances et dans le programme (sans remplacer une séance d’entraînement).</div>
        {!saved && <button className="btn block" style={{ marginTop: 8 }} onClick={save}>Enregistrer la séance d’étirements</button>}
      </div>}
    </div>}
  </Sheet>
}
/** Encart « récupération » après une séance */
export function StretchSuggest({ s }) {
  const r = suggestRoutine(s); if (!r) return null
  return <><h2 className="sec">Récupération</h2><List><Row icon="leaf" color="#30d158" title={r.name} sub={"Étirements conseillés · " + r.desc} href={"#/moi/etirements?r=" + r.id} /></List></>
}
