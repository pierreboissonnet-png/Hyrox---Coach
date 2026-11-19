// Séances spécialisées : création (modèles), chrono par blocs, saisie du réalisé, analyses.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, List, Row, Field, Seg, Empty, Icon, Stat, Sheet, useToast, useLoad } from '../ui.jsx'
import { LineChart, Bars, COLORS } from '../charts.jsx'
import { fmt, fd, parseT, frDate, todayISO, tone } from '../lib/hyrox.js'
import { EXERCISES, EX, CATS, METRICS, newBlock, defaultTarget, emptyCustom, doneOf, achievement, paceOf, e1rm, customSummary, customEnd, progression, kcalFromHR, kcalFromMET, fmtTarget, exLabel } from '../lib/custom.js'
import { series, hrStat, zonesOf, zoneOf, hrAt } from '../lib/hr.js'
import { activeTeams, KIND } from './common.js'
import { slotsOf, slotName } from './Teams.jsx'
import { KeeperPicker } from './Sessions.jsx'

const inp = { background: 'var(--glass)', borderRadius: 8, padding: '6px 8px', border: 0, minWidth: 0 }
const pct = a => a == null ? '—' : Math.round(a * 100) + ' %'

// ---------------------------------------------------------------- création
function TargetFields({ ex, target, onChange }) {
  const e = EX[ex] || {}, keys = ['time', 'meters', 'reps', 'load']
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
    {keys.map(k => <label key={k} className="tiny muted" style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: e.m && !e.m.includes(k) && !target[k] ? .55 : 1 }}>
      {METRICS[k][0]} <span className="faint">({METRICS[k][1]})</span>
      <input style={inp} inputMode={k === 'time' ? 'text' : 'decimal'} placeholder="—"
        defaultValue={target[k] == null ? '' : k === 'time' ? fmt(target[k]) : String(target[k])}
        onBlur={ev => { const v = ev.target.value.trim(); const n = v === '' ? null : k === 'time' ? parseT(v) : +v.replace(',', '.'); onChange({ ...target, [k]: Number.isNaN(n) ? target[k] : n }) }} />
    </label>)}
  </div>
}
function BlockEditor({ b, i, n, duo, names, onChange, onMove, onDel }) {
  return <div className="row stack">
    <div className="row-gap">
      <b className="num faint">{i + 1}</b>
      <select value={b.ex} onChange={e => onChange({ ...b, ex: e.target.value, target: defaultTarget(e.target.value) })} style={{ ...inp, flex: 1, textAlign: 'left', direction: 'ltr' }}>
        {CATS.map(([c, l]) => <optgroup key={c} label={l}>{EXERCISES.filter(x => x.cat === c).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>)}
      </select>
      <button className="icon-btn" aria-label="Monter" disabled={i === 0} onClick={() => onMove(-1)} style={{ width: 30, height: 30 }}>↑</button>
      <button className="icon-btn" aria-label="Descendre" disabled={i === n - 1} onClick={() => onMove(1)} style={{ width: 30, height: 30 }}>↓</button>
      <button className="icon-btn" aria-label="Supprimer l’exercice" onClick={onDel} style={{ width: 30, height: 30 }}><Icon name="trash" size={16} /></button>
    </div>
    {b.ex === 'free' && <input style={inp} placeholder="Nom de l’exercice (ex. gainage latéral)" value={b.name} onChange={e => onChange({ ...b, name: e.target.value })} />}
    <TargetFields key={b.ex} ex={b.ex} target={b.target} onChange={t => onChange({ ...b, target: t })} />
    <div className="row-gap small">
      <span>Séries</span><input style={{ ...inp, width: 48 }} inputMode="numeric" value={b.sets} onChange={e => onChange({ ...b, sets: e.target.value })} />
      <span>Récup</span><input style={{ ...inp, width: 56 }} inputMode="text" defaultValue={fmt(b.rest)} onBlur={e => { const v = parseT(e.target.value); onChange({ ...b, rest: Number.isNaN(v) || v == null ? 0 : v }) }} />
      {duo && <div className="seg" style={{ margin: 0, flex: 1, minWidth: 170 }}>{[['A', names.A], ['B', names.B], ['AB', 'Les deux']].map(([w, l]) => <button key={w} aria-pressed={b.w === w} onClick={() => onChange({ ...b, w })}>{l}</button>)}</div>}
    </div>
    <input style={inp} placeholder="Consigne (facultatif) : allure, tempo, zone…" value={b.note || ''} onChange={e => onChange({ ...b, note: e.target.value })} />
  </div>
}

export function NewCustom() {
  const { teams, profile, user, reload } = useApp(), toast = useToast()
  const tpls = useLoad(() => api.journal.list('workout'), [])
  const mine = activeTeams(teams, profile.id).filter(t => t.members.filter(m => !m.left_at).length === 2)
  const [f, setF] = useState({ title: '', format: 'solo', team: mine[0] ? mine[0].id : '', date: todayISO(), keeper: null })
  const [blocks, setBlocks] = useState(() => { try { const pf = JSON.parse(localStorage.getItem('hx-prefill') || 'null'); if (pf && pf.length) { localStorage.removeItem('hx-prefill'); return pf } } catch {} return [{ ...newBlock('run') }, { ...newBlock('ski') }, { ...newBlock('wb') }] })
  const [err, setErr] = useState('')
  const team = f.format === 'duo' ? mine.find(t => t.id === f.team) : null
  const names = team ? { A: slotName(team, 'A'), B: slotName(team, 'B') } : { A: profile.display_name, B: '' }
  const upd = (i, b) => setBlocks(L => L.map((x, k) => k === i ? b : x))
  const move = (i, d) => setBlocks(L => { const c = [...L]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c })
  async function saveTpl() {
    const name = f.title.trim() || prompt('Nom du modèle ?'); if (!name) return
    await api.journal.add({ kind: 'workout', day: todayISO(), data: { name, blocks } }); tpls.reload(); toast('Modèle enregistré')
  }
  async function create(live) {
    setErr('')
    if (!blocks.length) return setErr('Ajoutez au moins un exercice')
    if (f.format === 'duo' && !team) return setErr('Choisissez votre duo')
    const bl = blocks.map(b => ({ ...b, sets: Math.max(1, +b.sets || 1), w: team ? b.w : 'A' }))
    try {
      const s = await api.sessions.save({ owner: user.id, team_id: team ? team.id : null, kind: 'entrainement', session_date: f.date,
        name: f.title.trim() || 'Séance spécialisée du ' + frDate(f.date).slice(0, 5), athletes: team ? slotsOf(team) : { A: user.id, B: null },
        names: { A: names.A, B: team ? names.B : null }, timekeeper: f.keeper, plan: null, data: emptyCustom(bl, f.title.trim()) })
      await reload(['sessions']); location.hash = '#/seance/' + s.id + (live ? '/chrono' : '/temps')
    } catch (e) { setErr(e.message) }
  }
  return <Page back="#/seances" title="Séance spécialisée" subtitle="Ateliers Hyrox, course, musculation… avec vos objectifs en temps, mètres, répétitions ou charge.">
    {(tpls.data || []).length > 0 && <><h2 className="sec">Mes modèles</h2>
      <List>{tpls.data.map(t => <div className="row" key={t.id}><span className="label"><span className="t">{t.data.name}</span><span className="s">{t.data.blocks.map(exLabel).join(' · ')}</span></span>
        <button className="btn tinted small" onClick={() => { setBlocks(t.data.blocks); setF({ ...f, title: t.data.name }) }}>Charger</button>
        <button className="icon-btn" aria-label="Supprimer le modèle" onClick={async () => { if (confirm('Supprimer ce modèle ?')) { await api.journal.remove(t.id); tpls.reload() } }}><Icon name="trash" size={16} /></button></div>)}</List></>}
    <h2 className="sec">Séance</h2>
    <Seg value={f.format} onChange={v => setF({ ...f, format: v })} options={[['solo', 'Solo'], ['duo', 'Duo']]} />
    <List>
      <Field label="Titre"><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Force + SkiErg" /></Field>
      {f.format === 'duo' && <Field label="Duo"><select value={f.team} onChange={e => setF({ ...f, team: e.target.value })}>{mine.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
      <Field label="Date"><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
    </List>
    <h2 className="sec">Exercices et objectifs</h2>
    <List>{blocks.map((b, i) => <BlockEditor key={i + b.ex} b={b} i={i} n={blocks.length} duo={!!team} names={names} onChange={x => upd(i, x)} onMove={d => move(i, d)} onDel={() => setBlocks(L => L.filter((_, k) => k !== i))} />)}
      <Row icon="plus" color="#30d158" title="Ajouter un exercice" onClick={() => setBlocks(L => [...L, newBlock(L.length ? L[L.length - 1].ex : 'ski')])} /></List>
    <p className="foot">Renseignez seulement les objectifs utiles : temps pour finir (ex. 500 m en 1:50), durée à tenir (gainage 1:00), répétitions, charge. Les séries répètent l’exercice avec la récupération indiquée.</p>
    <h2 className="sec">Qui enregistre les temps ?</h2>
    <KeeperPicker value={f.keeper} onChange={k => setF({ ...f, keeper: k })} exclude={[user.id]} />
    {err && <p className="err">{err}</p>}
    <div className="row-gap" style={{ marginTop: 16 }}>
      <button className="btn" style={{ flex: 2 }} onClick={() => create(true)}><Icon name="play" size={18} />Chrono</button>
      <button className="btn glass" style={{ flex: 2 }} onClick={() => create(false)}>Saisir après coup</button>
      <button className="btn glass" style={{ flex: 1 }} onClick={saveTpl}>Modèle</button>
    </div>
  </Page>
}

// ---------------------------------------------------------------- chrono
function useNow(on) { const [n, setN] = useState(Date.now()); useEffect(() => { if (!on) return; const t = setInterval(() => setN(Date.now()), 200); return () => clearInterval(t) }, [on]); return n }
function DoneForm({ st, onSave, compact }) {
  const t = st.target || {}, d0 = st.done || {}
  const [v, setV] = useState({ meters: d0.meters ?? t.meters ?? '', reps: d0.reps ?? t.reps ?? '', load: d0.load ?? t.load ?? '', rpe: d0.rpe ?? 7 })
  const keys = ['meters', 'reps', 'load'].filter(k => t[k] != null || d0[k] != null)
  return <div>
    {keys.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${keys.length}, 1fr)`, gap: 6 }}>{keys.map(k => <label key={k} className="tiny muted" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{METRICS[k][0]} réalisé(e)<input style={inp} inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></label>)}</div>}
    <div className="row-gap small" style={{ marginTop: 6 }}><span>Effort ressenti</span><input type="range" min="1" max="10" value={v.rpe} onChange={e => setV({ ...v, rpe: +e.target.value })} style={{ flex: 1 }} aria-label="Effort ressenti" /><b className="num">{v.rpe}/10</b></div>
    <button className={'btn block ' + (compact ? 'small' : '')} style={{ marginTop: 8 }} onClick={() => onSave({ ...(d0.time != null ? { time: d0.time } : {}), meters: v.meters === '' ? null : +String(v.meters).replace(',', '.'), reps: v.reps === '' ? null : +v.reps, load: v.load === '' ? null : +String(v.load).replace(',', '.'), rpe: v.rpe })}>Valider</button>
  </div>
}
export function CustomChrono({ s, commit, who, undo, canUndo, keeperOnly }) {
  const d = s.data, steps = d.steps || []
  const started = d.startedAt != null
  const cur = steps.findIndex(x => x.e == null), finished = started && cur < 0
  const pendingDone = steps.findIndex(x => x.e != null && !x.done)
  const now = useNow(started && !finished)
  const t = started ? now - d.startedAt : 0
  const cl = () => JSON.parse(JSON.stringify(d))
  const rel = () => Date.now() - d.startedAt
  if (!started) return <div className="glass card center">
    <div className="clock num">0:00</div>
    <p className="muted">{steps.length} étape(s) : {[...new Set(steps.map(exLabel))].join(', ')}</p>
    <button className="btn green block" style={{ minHeight: 70, fontSize: 20 }} onClick={() => commit({ ...cl(), startedAt: Date.now() })}><Icon name="play" />Départ</button>
  </div>
  const st = cur >= 0 ? steps[cur] : null, prev = cur > 0 ? steps[cur - 1] : cur < 0 ? steps[steps.length - 1] : null
  const restLeft = st && st.s == null && prev && prev.e != null && prev.rest ? prev.rest - (t - prev.e) / 1000 : null
  const nm = w => w === 'AB' ? 'Les deux' : who(w)
  return <>
    <div className="glass card">
      <div className="clock num">{fmt(t / 1000)}</div>
      <div className="progress"><i style={{ width: ((cur < 0 ? steps.length : cur) / steps.length * 100) + '%' }} /></div>
      {st ? <>
        <div className="cur">{exLabel(st)}{st.of > 1 ? ` · série ${st.set}/${st.of}` : ''}</div>
        <div className="cur-sub">Objectif : {fmtTarget(st.target)}{s.athletes.B ? ' · ' + nm(st.w) : ''}{st.note ? ' · ' + st.note : ''}</div>
        {st.s == null ? <>
          {restLeft != null && <div className={'center num ' + (restLeft > 0 ? '' : 'good')} style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>{restLeft > 0 ? 'Récup ' + fmt(restLeft) : 'C’est reparti !'}</div>}
          <div className="pad"><button className="btn green full" onClick={() => { const x = cl(); x.steps[cur].s = rel(); commit(x) }}><Icon name="play" />Démarrer<small>{exLabel(st)}</small></button></div>
        </> : <>
          <div className="center num" style={{ fontSize: 34, fontWeight: 700 }}>{fmt((t - st.s) / 1000, true)}{st.target.time ? <span className="muted small"> / {fmt(st.target.time)}</span> : ''}</div>
          <div className="pad" style={{ marginTop: 10 }}><button className="btn red full" onClick={() => { const x = cl(); x.steps[cur].e = rel(); commit(x) }}>Terminé<small>enregistrer le temps</small></button></div>
        </>}
      </> : <div className="center"><div className="cur">Séance terminée</div><div className="cur-sub">Durée totale {fmt(customSummary(s).total)}</div>
        <a className="btn" href={'#/seance/' + s.id + (keeperOnly ? '/temps' : '/stats')}>{keeperOnly ? 'Voir les résultats' : 'Voir l’analyse'}</a></div>}
    </div>
    {pendingDone >= 0 && <div className="glass card"><div className="small" style={{ marginBottom: 6 }}><b>{exLabel(steps[pendingDone])}{steps[pendingDone].of > 1 ? ` (série ${steps[pendingDone].set})` : ''}</b> en {fmt(doneOf(steps[pendingDone]).time)} : qu’avez-vous réalisé ?</div>
      <DoneForm key={pendingDone} st={steps[pendingDone]} compact onSave={v => { const x = cl(); x.steps[pendingDone].done = v; commit(x) }} /></div>}
    <div className="row-gap"><button className="btn glass small" disabled={!canUndo} onClick={undo}><Icon name="undo" size={16} />Annuler</button><span className="spacer" />
      {st && <button className="btn plain small" onClick={() => { const x = cl(); const k = cur; if (x.steps[k].s == null) x.steps[k].s = rel(); x.steps[k].e = x.steps[k].s; x.steps[k].done = { skipped: true }; commit(x) }}>Passer l’étape</button>}
      <span className="small muted">Étape {Math.min(steps.length, cur < 0 ? steps.length : cur + 1)}/{steps.length}</span></div>
    <List>{steps.map((x, i) => { const dn = doneOf(x), a = achievement(x); return <Row key={i} title={`${exLabel(x)}${x.of > 1 ? ' · ' + x.set + '/' + x.of : ''}`} sub={'Objectif ' + fmtTarget(x.target)} value={x.e != null ? <span className={a == null ? '' : a >= 1 ? 'good' : a < 0.9 ? 'bad' : 'even'}>{fmt(dn.time)}{a != null ? ' · ' + pct(a) : ''}</span> : i === cur ? '…' : ''} /> })}</List>
  </>
}

// ---------------------------------------------------------------- réalisé (saisie / correction)
export function CustomResults({ s, commit, patch, keeperOnly }) {
  const { reload } = useApp()
  const d = s.data, steps = d.steps || []
  const [open, setOpen] = useState(null)
  const sum = customSummary(s)
  const setDone = (i, v) => { const x = JSON.parse(JSON.stringify(d)); x.steps[i].done = v; commit(x) }
  async function del() { if (!confirm('Supprimer définitivement cette séance ?')) return; await api.sessions.remove(s.id); await reload(['sessions']); location.hash = '#/seances' }
  return <>
    <div className="stats"><Stat k="Étapes réalisées" v={`${sum.done}/${sum.n}`} /><Stat k="Objectifs atteints" v={pct(sum.achievement)} tone={sum.achievement >= 1 ? 'good' : 'bad'} /><Stat k="Temps de travail" v={fmt(sum.work)} d={sum.rest ? 'récup ' + fmt(sum.rest) : ''} /></div>
    <List>{steps.map((x, i) => { const dn = doneOf(x), a = achievement(x), pc = paceOf(x); return <React.Fragment key={i}>
      <Row title={`${exLabel(x)}${x.of > 1 ? ' · série ' + x.set + '/' + x.of : ''}`} sub={`Objectif ${fmtTarget(x.target)} · réalisé ${fmtTarget(dn)}${pc ? ' · ' + (pc.rate ? pc.v.toFixed(1).replace('.', ',') : fmt(pc.v)) + ' ' + pc.u : ''}${dn.rpe ? ' · effort ' + dn.rpe + '/10' : ''}`}
        value={<span className={a == null ? 'faint' : a >= 1 ? 'good' : a < 0.9 ? 'bad' : 'even'}>{pct(a)}</span>} onClick={() => setOpen(open === i ? null : i)} />
      {open === i && <div className="row stack" style={{ background: 'var(--fill)' }}>
        <label className="tiny muted" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>Temps réalisé (mm:ss)<input style={inp} defaultValue={dn.time != null ? fmt(dn.time) : ''} onBlur={e => { const v = parseT(e.target.value); if (!Number.isNaN(v)) setDone(i, { ...(x.done || {}), time: v }) }} /></label>
        <DoneForm st={x} onSave={v => { setDone(i, { ...v, time: (x.done && x.done.time) ?? (dn.time ?? null) }); setOpen(null) }} />
      </div>}
    </React.Fragment> })}</List>
    <p className="foot">Touchez une étape pour saisir ou corriger le réalisé (utile pour une séance faite sans le chrono).</p>
    <List><div className="row stack"><span className="small muted">Note</span><textarea defaultValue={d.note || ''} onBlur={e => commit({ ...d, note: e.target.value })} /></div></List>
    {!keeperOnly && <button className="btn plain block" style={{ color: 'var(--bad)', marginTop: 10 }} onClick={del}>Supprimer la séance</button>}
  </>
}

// ---------------------------------------------------------------- analyse (cardio + progression + dépense)
/** FC par étape pour un athlète */
export function hrBySteps(s, row) {
  const S = series(row); if (!S) return {}
  const out = {}; (s.data.steps || []).forEach((x, i) => { if (x.s != null && x.e != null && x.e > x.s) { const h = hrStat(S, x.s / 1000, x.e / 1000); if (h) out[i] = h } })
  return out
}
export function CustomStats({ s, who }) {
  const { profile, teams } = useApp()
  const rows = useLoad(() => api.hr.list(s.id), [s.id])
  const sum = customSummary(s), steps = sum.steps, d = s.data
  const slots = s.athletes.B ? ['A', 'B'] : ['A']
  const prof = w => { const id = s.athletes[w]; if (id === profile.id) return profile; for (const t of teams) { const m = t.members.find(x => x.user_id === id); if (m) return m.profile } return null }
  const get = w => (rows.data || []).find(r => r.user_id === s.athletes[w])
  const meSlot = s.athletes.A === profile.id ? 'A' : s.athletes.B === profile.id ? 'B' : 'A'
  const by = get(meSlot) ? hrBySteps(s, get(meSlot)) : {}
  const zones = zonesOf(prof(meSlot))
  const prog = progression(s, by, zones)
  const S = get(meSlot) ? series(get(meSlot)) : null
  const end = customEnd(d) / 1000
  const all = S ? hrStat(S, 0, end) : null
  const kcal = all ? kcalFromHR(all.avg, end / 60, prof(meSlot)) : kcalFromMET(steps.filter(x => x.w === meSlot || x.w === 'AB'), prof(meSlot))
  const z = [0, 0, 0, 0, 0]; let n = 0
  if (S) for (let t = 0; t <= end; t++) { const v = hrAt(S, t); if (v != null) { z[zoneOf(zones, v) - 1]++; n++ } }
  const bands = steps.filter(x => x.s != null && x.e != null).map(x => ({ a: x.s / 1000, b: x.e / 1000, color: s.athletes.B ? COLORS[x.w === 'B' ? 'B' : 'A'] : '#5e5ce6' }))
  const ser = slots.map(w => { const R = series(get(w)); return R && { color: COLORS[w], pts: R.t.map((x, k) => [x, R.b[k]]).filter(([x]) => x >= -60 && x <= end + 60) } }).filter(Boolean)
  if (!sum.done) return <div className="glass card"><Empty icon="chart">L’analyse apparaît après la première étape réalisée.</Empty></div>
  return <>
    <div className="stats">
      <Stat k="Objectifs atteints" v={pct(sum.achievement)} d={`${sum.done}/${sum.n} étapes`} tone={sum.achievement >= 1 ? 'good' : sum.achievement < 0.9 ? 'bad' : 'even'} />
      <Stat k="Durée" v={fmt(sum.total)} d={'travail ' + fmt(sum.work)} />
      <Stat k="Dépense estimée" v={kcal ? kcal + ' kcal' : '—'} d={all ? 'd’après la FC' : 'estimation sans cardio'} />
      <Stat k="FC moyenne / max" v={all ? Math.round(all.avg) + ' / ' + all.max : '—'} d={all ? '' : 'importez le cardio (onglet Cardio)'} />
    </div>
    {ser.length > 0 && <div className="glass card"><LineChart series={ser} bands={bands} height={170} /><div className="legend">{slots.map(w => <span key={w}><span className={w === 'A' ? 'dotA' : 'dotB'} />{who(w)}</span>)}<span>bandes = exercices</span></div>
      {n > 0 && <div className="zones" style={{ marginTop: 8 }}>{z.map((v, i) => <i key={i} className={'z' + (i + 1)} style={{ width: (v / n * 100) + '%' }} />)}</div>}</div>}
    <h2 className="sec">Exercice par exercice</h2>
    <div className="glass card scroll-x"><table className="tbl"><thead><tr><th>Étape</th><th className="r">Objectif</th><th className="r">Réalisé</th><th className="r">%</th><th className="r">FC moy/max</th></tr></thead><tbody>
      {steps.map((x, i) => { const dn = doneOf(x), a = achievement(x), h = by[i]; return <tr key={i}><td>{exLabel(x)}{x.of > 1 ? ' ' + x.set + '/' + x.of : ''}</td><td className="r small">{fmtTarget(x.target)}</td><td className="r small">{fmtTarget(dn)}</td>
        <td className={'r num ' + (a == null ? 'faint' : a >= 1 ? 'good' : a < 0.9 ? 'bad' : 'even')}>{pct(a)}</td><td className="r num">{h ? Math.round(h.avg) + ' / ' + h.max : '—'}</td></tr> })}
    </tbody></table></div>
    <h2 className="sec">Objectifs proposés pour la prochaine fois</h2>
    <List>{prog.map((p, i) => <div className="row stack" key={i}><div className="row-gap"><b>{p.label}</b><span className="spacer" /><span className={'badge ' + (p.achievement >= 1 ? 'good' : p.achievement < 0.9 ? 'bad' : '')}>{pct(p.achievement)}</span></div>
      <span className="small">{fmtTarget(p.target)} → <b>{fmtTarget(p.next)}</b></span><span className="small muted">{p.why}{p.e1rm ? ` · 1RM estimé ${Math.round(p.e1rm)} kg` : ''}{p.hmax ? ` · FC max ${p.hmax}` : ''}</span></div>)}</List>
    <p className="foot">Les ateliers Hyrox et la course réalisés ici alimentent aussi vos temps prédits (comptés à 70 %, car effectués « à frais », hors enchaînement), le programme et la dépense du jour dans le coach nutrition.</p>
  </>
}
