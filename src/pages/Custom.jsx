// Séances spécialisées : création (modèles), chrono par blocs, saisie du réalisé, analyses.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { hasB } from '../lib/session.js'
import { api } from '../lib/api.js'
import { Page, List, Row, Field, Seg, Empty, Icon, Stat, Sheet, useToast, useLoad, parseNum, TIME, maskT, go, Chips } from '../ui.jsx'
import { createPortal } from 'react-dom'
import { LineChart, Bars, COLORS } from '../charts.jsx'
import { fmt, fd, parseT, frDate, todayISO, tone } from '../lib/hyrox.js'
import { EXERCISES, EX, CATS, METRICS, STRENGTH, FORMATS, newBlock, newGroup, isGroup, expand, defaultTarget, emptyCustom, doneOf, achievement, paceOf, e1rm, customSummary, customEnd, progression, kcalFromHR, kcalFromMET, fmtTarget, exLabel, stepLabel } from '../lib/custom.js'
import { LIBRARY, LIB_CATS, LIB } from '../lib/library.js'
import { activeZones, hits, altFor, adaptBlocks, ZONE } from '../lib/pain.js'
import { StretchSuggest } from './Body.jsx'
import { series, hrStat, zonesOf, zoneOf, hrAt } from '../lib/hr.js'
import { activeTeams, KIND } from './common.js'
import { slotsOf, slotName } from './Teams.jsx'
import { KeeperPicker } from './Sessions.jsx'

const inp = { background: 'var(--fill)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(120,120,128,.35)', minWidth: 0, width: '100%', textAlign: 'left', fontSize: 16, color: 'var(--ink)', boxSizing: 'border-box' }
const pct = a => a == null ? '—' : Math.round(a * 100) + ' %'

// ---------------------------------------------------------------- création
const fmtVal = (k, v) => v == null || v === '' ? '' : k === 'time' ? fmt(v) : String(v).replace('.', ',')
const readVal = (k, v) => { v = String(v || '').trim(); if (v === '') return null; if (k === 'time') { const n = parseT(v); return Number.isNaN(n) ? undefined : n } const n = parseNum(v); return n == null ? undefined : n }
/** Champs d'objectif : seulement ceux utiles à l'exercice (+ « autre mesure » au besoin) */
function TargetFields({ ex, target, onChange, hide = [], strength }) {
  const e = EX[ex] || {}
  const base = (e.m || ['time', 'reps']).filter(k => k !== 'rounds')
  const [extra, setExtra] = useState(() => Object.keys(target || {}).filter(k => target[k] != null && !base.includes(k) && METRICS[k]))
  const keys = [...new Set([...base, ...extra])].filter(k => !hide.includes(k))
  const others = ['time', 'meters', 'reps', 'load', 'cal', 'res'].filter(k => !keys.includes(k) && !hide.includes(k))
  const cols = keys.length + (strength ? 1 : 0)
  const [help, setHelp] = useState(false)
  return <div>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, cols)}, 1fr)`, gap: 6 }}>
      {keys.map(k => <label key={k} className="small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {METRICS[k][0]}{e.uni && (k === 'reps' || k === 'time') ? ' / côté' : ''} <span className="faint">({METRICS[k][1]})</span>
        <input style={inp} {...(k === 'time' ? TIME : { inputMode: 'decimal', placeholder: '—' })} defaultValue={fmtVal(k, target[k])}
          onBlur={ev => { const n = readVal(k, ev.target.value); if (n !== undefined) onChange({ ...target, [k]: n }) }} />
      </label>)}
      {strength && <label className="small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span>Reps en réserve <button type="button" className="link" aria-label="Qu’est-ce que les reps en réserve ?" onClick={ev => { ev.preventDefault(); setHelp(h => !h) }} style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent)', fontSize: 13 }}>ⓘ</button></span>
        <input style={inp} inputMode="numeric" placeholder="ex. 2" defaultValue={target.rir ?? ''} onBlur={ev => { const n = readVal('rir', ev.target.value); if (n !== undefined) onChange({ ...target, rir: n }) }} /></label>}
    </div>
    {help && <div className="note small" style={{ margin: '6px 0 0' }}><b>Reps en réserve (RIR)</b> : combien de répétitions vous auriez encore pu faire en fin de série. 8 reps avec 2 en réserve = une charge avec laquelle vous pourriez en faire 10. <b>0</b> = jusqu’à l’échec · <b>1–2</b> = dur mais propre, idéal pour progresser · <b>3–4</b> = confortable (semaine chargée, technique). Pour l’Hyrox, visez 1 à 3. Facultatif.</div>}
    {others.length > 0 && <div className="row-gap tiny" style={{ marginTop: 4, gap: 4 }}><span className="faint">+ mesure :</span>{others.map(k => <button key={k} className="link" style={{ fontSize: 14, padding: '2px 6px', minHeight: 0, background: 'none', border: 0, color: 'var(--accent)' }} onClick={() => setExtra(x => [...x, k])}>{METRICS[k][0].toLowerCase()}</button>)}</div>}
  </div>
}
const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Autres noms courants, pour la recherche
const ALIAS = { run: 'footing running jogging', bike: 'velo cyclisme home trainer', airbike: 'assault echo bike', row: 'rowing aviron rameur', ski: 'ski erg', wb: 'wallball wall ball medecine', burp: 'burpee saut', farm: 'farmer kettlebell marche', lunge: 'fente sac', squat: 'back squat flexion', deadlift: 'sdt deadlift', rdl: 'roumain rdl', bench: 'bench pecs', ohp: 'press militaire epaules', bentrow: 'tirage barre dos', hipthrust: 'pont fessier fessiers glute', pushup: 'pompe push up', pullup: 'traction pull up', plank: 'planche abdos', sideplank: 'planche laterale', legpress: 'presse', latpull: 'tirage poitrine lat pulldown', seatedrow: 'tirage assis poulie', legcurl: 'ischios', legext: 'quadriceps', calf: 'mollets', goblet: 'squat haltere', dbpress: 'developpe halteres pecs', curl: 'biceps', triceps: 'triceps', lateral: 'epaules deltoides', kbswing: 'kettlebell', airsquat: 'squat sans charge', mountain: 'abdos', abwheel: 'abdos', legraise: 'abdos', hollow: 'abdos gainage', russian: 'abdos obliques', mobility: 'etirements souplesse', foam: 'massage', rope: 'corde', swim: 'piscine nage', stairs: 'escaliers', walk: 'marche' }
function ExSelect({ value, name, onChange, style }) {
  const [open, setOpen] = useState(false)
  const label = value === 'free' && name ? name : (EX[value] || {}).label || 'Choisir'
  return <>
    <button type="button" onClick={() => setOpen(true)} style={{ ...inp, flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontSize: 16, ...style }} aria-label={'Exercice : ' + label + '. Changer'}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span><Icon name="chev" size={14} style={{ transform: 'rotate(90deg)', opacity: .5 }} /></button>
    {open && createPortal(<ExSheet value={value} onClose={() => setOpen(false)} onPick={(ex, nm) => { setOpen(false); onChange(ex, nm) }} />, document.body)}
  </>
}
function ExSheet({ value, onPick, onClose }) {
  const [q, setQ] = useState(''), [openCat, setOpenCat] = useState(() => (EX[value] || {}).cat || null)
  const terms = norm(q).split(/\s+/).filter(Boolean)
  const match = e => !terms.length || terms.every(t => norm(e.label + ' ' + (ALIAS[e.id] || '') + ' ' + ((CATS.find(c => c[0] === e.cat) || [])[1] || '')).includes(t))
  const L = EXERCISES.filter(e => e.cat !== 'fmt' && e.cat !== 'sport' && match(e))
  return <Sheet title="Choisir un exercice" onClose={onClose} noBug>
    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher : pompes, squat, rameur…" aria-label="Rechercher un exercice"
      style={{ width: '100%', boxSizing: 'border-box', fontSize: 17, padding: '10px 12px', borderRadius: 12, border: 0, background: 'var(--fill)', color: 'var(--ink)', marginBottom: 10 }} />
    {terms.length ? <p className="small muted" style={{ margin: '0 4px 6px' }}>{L.length} résultat(s)</p> : <p className="small muted" style={{ margin: '0 4px 6px' }}>Touchez une catégorie pour l’ouvrir, ou tapez un nom.</p>}
    <List>{CATS.filter(([c]) => c !== 'sport').map(([c, l]) => { const E = L.filter(e => e.cat === c); if (!E.length) return null; const op = terms.length > 0 || openCat === c
      return <React.Fragment key={c}>
        <button className="row" onClick={() => setOpenCat(op && !terms.length ? null : c)} style={{ width: '100%', background: op ? 'var(--accent-soft)' : 'transparent' }} aria-expanded={op}>
          <span className="label"><span className="t" style={{ fontWeight: 650 }}>{l}</span></span><span className="val small muted">{E.length}</span>
          <Icon name="chev" size={14} style={{ transform: op ? 'rotate(90deg)' : 'none', opacity: .5, transition: 'transform .15s' }} /></button>
        {op && E.map(e => <Row key={e.id} title={e.label} sub={e.uni ? 'unilatéral (par côté)' : null} value={e.id === value ? '✓' : ''} chev={false} onClick={() => onPick(e.id, '')} className="indent" />)}
      </React.Fragment> })}</List>
    {q.trim() && <List><Row icon="plus" color="#30d158" title={'Exercice libre « ' + q.trim() + ' »'} sub="Pas dans la liste ? Créez-le avec ce nom" onClick={() => onPick('free', q.trim())} /></List>}
    {!L.length && !q.trim() && <Empty>Aucun exercice.</Empty>}
  </Sheet>
}
function PainWarn({ ex, zones, onSwap }) {
  const h = hits(ex, zones); if (!h.length) return null
  const a = altFor(ex, zones)
  return <div className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--warn, #ff9f0a)' }}>
    <span>⚠ Sollicite {h.map(z => (ZONE[z] || z).toLowerCase()).join(', ')} (douleur déclarée)</span>
    {a && <button className="btn tinted small" style={{ minHeight: 0, padding: '3px 8px' }} onClick={() => onSwap(a)}>Remplacer par {EX[a].label}</button>}
  </div>
}
const Tools = ({ i, n, onMove, onDel, onDrag }) => <>
  {onDrag && <span role="button" aria-label="Faire glisser pour déplacer" title="Faire glisser pour changer l’ordre" onPointerDown={onDrag}
    style={{ touchAction: 'none', cursor: 'grab', width: 34, height: 34, display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--ink-3)', userSelect: 'none' }}>≡</span>}
  <button className="icon-btn" aria-label="Monter" disabled={i === 0} onClick={() => onMove(-1)} style={{ width: 30, height: 30 }}>↑</button>
  <button className="icon-btn" aria-label="Descendre" disabled={i === n - 1} onClick={() => onMove(1)} style={{ width: 30, height: 30 }}>↓</button>
  <button className="icon-btn" aria-label="Supprimer" onClick={onDel} style={{ width: 30, height: 30 }}><Icon name="trash" size={16} /></button>
</>
const WhoSeg = ({ b, names, onChange }) => <div className="seg" style={{ margin: 0, flex: 1, minWidth: 170 }}>{[['A', names.A], ['B', names.B], ['AB', 'Les deux']].map(([w, l]) => <button key={w} aria-pressed={(b.w || 'A') === w} onClick={() => onChange({ ...b, w })}>{l}</button>)}</div>
const num = (v, d = 0) => { const n = parseNum(v); return n == null ? d : n }

function BlockEditor({ b, i, n, duo, names, zones, onChange, onMove, onDel, onDrag }) {
  const e = EX[b.ex] || {}, strength = STRENGTH.includes(e.cat), sets = Math.max(1, +b.sets || 1)
  const per = !!b.setTargets
  const setKeys = (e.m || []).filter(k => k !== 'time' || !strength).filter(k => k !== 'rounds')
  const swap = (ex, name = '') => onChange({ ...b, ex, name, target: defaultTarget(ex), setTargets: undefined })
  return <div className="row stack">
    <div className="row-gap"><ExSelect value={b.ex} name={b.name} onChange={swap} /><Tools i={i} n={n} onMove={onMove} onDel={onDel} onDrag={onDrag} /></div>
    {b.ex === 'free' && <input style={inp} placeholder="Nom de l’exercice (ex. gainage latéral)" value={b.name} onChange={ev => onChange({ ...b, name: ev.target.value })} />}
    <PainWarn ex={b.ex} zones={zones} onSwap={swap} />
    {!per && <TargetFields key={b.ex} ex={b.ex} target={b.target || {}} strength={strength} onChange={t => onChange({ ...b, target: t })} />}
    {per && <div className="glass" style={{ borderRadius: 10, padding: 6 }}>
      {Array.from({ length: sets }, (_, k) => { const t = { ...b.target, ...(b.setTargets[k] || {}) }; return <div key={k + b.ex} className="row-gap small" style={{ gap: 6, marginBottom: 4 }}>
        <span className="faint num" style={{ width: 52 }}>Série {k + 1}</span>
        {setKeys.map(key => <input key={key} style={{ ...inp, width: 0, flex: 1 }} {...(key === 'time' ? TIME : { inputMode: 'decimal' })} placeholder={METRICS[key][1]} aria-label={METRICS[key][0] + ' série ' + (k + 1)} defaultValue={fmtVal(key, t[key])}
          onBlur={ev => { const v = readVal(key, ev.target.value); if (v === undefined) return; const st = [...b.setTargets]; st[k] = { ...(st[k] || {}), [key]: v }; onChange({ ...b, setTargets: st }) }} />)}
      </div> })}
      <div className="tiny faint">Pyramide, séries dégressives… chaque série a son objectif ({setKeys.map(k => METRICS[k][1]).join(', ')}).</div>
    </div>}
    <div className="row-gap small">
      <span>Séries</span><input style={{ ...inp, width: 44 }} inputMode="numeric" value={b.sets} onChange={ev => onChange({ ...b, sets: ev.target.value, setTargets: b.setTargets ? Array.from({ length: Math.max(1, +ev.target.value || 1) }, (_, k) => b.setTargets[k] || {}) : undefined })} />
      <span>Récup</span><input style={{ ...inp, width: 56 }} {...TIME} defaultValue={fmt(b.rest)} onBlur={ev => { const v = parseT(ev.target.value); onChange({ ...b, rest: Number.isNaN(v) || v == null ? 0 : v }) }} />
      {strength && <><span>Tempo</span><input style={{ ...inp, width: 64 }} placeholder="3-1-1" value={b.tempo || ''} onChange={ev => onChange({ ...b, tempo: ev.target.value })} title="Descente – pause – montée, en secondes" /></>}
      {sets > 1 && <label className="row-gap tiny" style={{ gap: 4 }}><input type="checkbox" checked={per} onChange={ev => onChange({ ...b, setTargets: ev.target.checked ? Array.from({ length: sets }, () => ({ ...b.target })) : undefined })} />Séries différentes</label>}
      {duo && <WhoSeg b={b} names={names} onChange={onChange} />}
    </div>
    <input style={inp} placeholder="Consigne (facultatif) : allure, zone, technique…" value={b.note || ''} onChange={ev => onChange({ ...b, note: ev.target.value })} />
  </div>
}

function GroupEditor({ b, i, n, duo, names, zones, onChange, onMove, onDel, onDrag }) {
  const F = FORMATS[b.fmt] || {}, timed = b.fmt === 'tabata' || b.fmt === 'interval'
  const setItem = (j, it) => onChange({ ...b, items: b.items.map((x, k) => k === j ? it : x) })
  const P = ({ label, k, time, w = 52 }) => <><span>{label}</span><input style={{ ...inp, width: w }} {...(time ? TIME : { inputMode: 'numeric' })} defaultValue={time ? fmt(b[k]) : b[k]} key={b.fmt + k}
    onBlur={ev => { const v = time ? parseT(ev.target.value) : num(ev.target.value, b[k]); onChange({ ...b, [k]: Number.isNaN(v) || v == null ? b[k] : v }) }} /></>
  return <div className="row stack" style={{ background: 'var(--accent-soft)', borderLeft: '3px solid var(--accent)' }}>
    <div className="row-gap">
      <select value={b.fmt} onChange={ev => onChange({ ...newGroup(ev.target.value), items: b.items, w: b.w })} style={{ ...inp, flex: 1, fontWeight: 600, appearance: 'auto' }}>{Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select>
      <Tools i={i} n={n} onMove={onMove} onDel={onDel} onDrag={onDrag} /></div>
    <div className="small muted">{F.hint}</div>
    <div className="row-gap small">
      {(b.fmt === 'circuit' || b.fmt === 'superset') && <><P label="Tours" k="rounds" />{b.fmt === 'circuit' && <P label="Récup entre exercices" k="restItem" time />}<P label="Récup après le tour" k="rest" time /></>}
      {b.fmt === 'emom' && <P label="Minutes" k="minutes" />}
      {b.fmt === 'amrap' && <><P label="Durée (min)" k="minutes" /><span>Objectif</span><input style={{ ...inp, width: 52 }} inputMode="numeric" defaultValue={(b.target || {}).rounds || ''} onBlur={ev => onChange({ ...b, target: { ...b.target, rounds: num(ev.target.value, null) } })} /><span>tours</span></>}
      {timed && <><P label="Tours" k="rounds" /><P label="Effort (s)" k="work" /><P label="Récup (s)" k="rest" /></>}
      {duo && <WhoSeg b={b} names={names} onChange={onChange} />}
    </div>
    {b.items.map((it, j) => <div key={j} style={{ paddingLeft: 10, borderLeft: '1px dashed var(--sep)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="row-gap"><span className="tiny faint">{String.fromCharCode(97 + j)}.</span><ExSelect value={it.ex} name={it.name} onChange={(ex, name = '') => setItem(j, { ...it, ex, name, target: defaultTarget(ex, true) })} />
        <button className="icon-btn" aria-label="Retirer l’exercice du bloc" disabled={b.items.length < 2} onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== j) })} style={{ width: 30, height: 30 }}><Icon name="close" size={14} /></button></div>
      {it.ex === 'free' && <input style={inp} placeholder="Nom de l’exercice" value={it.name} onChange={ev => setItem(j, { ...it, name: ev.target.value })} />}
      <PainWarn ex={it.ex} zones={zones} onSwap={ex => setItem(j, { ...it, ex, target: defaultTarget(ex, true) })} />
      <TargetFields key={it.ex} ex={it.ex} target={it.target || {}} hide={timed || b.fmt === 'amrap' || b.fmt === 'emom' ? ['time'] : []} onChange={t => setItem(j, { ...it, target: t })} />
    </div>)}
    <button className="btn plain small" style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...b, items: [...b.items, { ex: 'burpee', name: '', target: defaultTarget('burpee', true), note: '' }] })}><Icon name="plus" size={14} />Exercice dans ce bloc</button>
  </div>
}

/** Bibliothèque : séances types + modèles personnels */
function LibrarySheet({ tpls, onPick, onDelTpl, onClose }) {
  const [cat, setCat] = useState((tpls || []).length ? 'mine' : 'renfo')
  const L = cat === 'mine' ? (tpls || []).map(t => ({ id: t.id, name: t.data.name, desc: t.data.blocks.map(b => isGroup(b) ? FORMATS[b.fmt].label + ' (' + b.items.map(exLabel).join(', ') + ')' : exLabel(b)).join(' · '), blocks: t.data.blocks, mine: true })) : LIBRARY.filter(t => t.cat === cat)
  return <Sheet title="Bibliothèque de séances" onClose={onClose}>
    <Chips value={cat} onChange={setCat} label="Catégories" options={[['mine', 'Mes modèles'], ...LIB_CATS]} />
    {L.length ? <List>{L.map(t => <div className="row" key={t.id}><span className="label"><span className="t">{t.name}</span><span className="s">{t.desc}</span></span>
      <button className="btn tinted small" onClick={() => onPick(t)}>Choisir</button>
      {t.mine && <button className="icon-btn" aria-label="Supprimer le modèle" onClick={() => onDelTpl(t.id)}><Icon name="trash" size={16} /></button>}</div>)}</List>
      : <div className="glass card"><Empty icon="bolt">Aucun modèle personnel. Composez une séance puis « Enregistrer comme modèle ».</Empty></div>}
    <p className="foot">Une séance choisie reste modifiable : exercices, charges, séries, récupérations.</p>
  </Sheet>
}

export function NewCustom() {
  const { teams, profile, user, reload } = useApp(), toast = useToast()
  const tpls = useLoad(() => api.journal.list('workout'), [])
  const pains = useLoad(() => profile.consent_health ? api.journal.list('pain') : [], [])
  const zones = activeZones(pains.data || [])
  const mine = activeTeams(teams, profile.id).filter(t => t.members.filter(m => !m.left_at).length === 2)
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  const { sessions } = useApp()
  const editing = q.get('edit') ? sessions.find(x => x.id === q.get('edit')) : null   // modifier une séance prévue
  const pre = useMemo(() => { if (editing) return { blocks: JSON.parse(JSON.stringify(editing.data.blocks || [])), title: editing.name, date: editing.session_date }
    try { const pf = JSON.parse(localStorage.getItem('hx-prefill') || 'null'); if (pf) { localStorage.removeItem('hx-prefill'); return Array.isArray(pf) ? { blocks: pf } : pf } } catch {} const t = q.get('tpl') && LIB[q.get('tpl')]; return t ? { blocks: t.blocks, title: t.name } : null }, [])
  const [f, setF] = useState({ title: (pre && pre.title) || '', format: editing && editing.team_id ? 'duo' : 'solo', team: (editing && editing.team_id) || (mine[0] ? mine[0].id : ''), date: q.get('date') || (pre && pre.date) || todayISO(), keeper: null })
  const [blocks, setBlocks] = useState(() => (pre && pre.blocks && pre.blocks.length) ? pre.blocks : [newBlock('run'), newBlock('ski'), newBlock('wb')])
  const [err, setErr] = useState(''), [lib, setLib] = useState(q.get('lib') === '1'), [adding, setAdding] = useState(false)
  const team = f.format === 'duo' ? mine.find(t => t.id === f.team) : null
  const names = team ? { A: slotName(team, 'A'), B: slotName(team, 'B') } : { A: profile.display_name, B: '' }
  const upd = (i, b) => setBlocks(L => L.map((x, k) => k === i ? b : x))
  // Glisser-déposer : on maintient la poignée ≡ et on déplace l'exercice ; l'ordre change dès qu'on survole une autre carte
  const [drag, setDrag] = useState(null)
  function startDrag(i, e) {
    e.preventDefault(); let cur = i; setDrag(i)
    const mv = ev => {
      const y = ev.clientY, cards = [...document.querySelectorAll('[data-blk]')]; let t = cur
      cards.forEach((el, k) => { const r = el.getBoundingClientRect(); if (k !== cur && y > r.top + r.height * 0.25 && y < r.bottom - r.height * 0.25) t = k })
      if (t !== cur) { const from = cur; setBlocks(L => { const c = [...L]; const [x] = c.splice(from, 1); c.splice(t, 0, x); return c }); cur = t; setDrag(t) }
      if (y < 80) scrollBy(0, -12); else if (y > innerHeight - 120) scrollBy(0, 12)
    }
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); setDrag(null) }
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up)
  }
  const move = (i, d) => setBlocks(L => { const c = [...L]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c })
  const nSteps = useMemo(() => expand(blocks).length, [blocks])
  const future = f.date > todayISO()
  const painSwaps = useMemo(() => zones.length ? adaptBlocks(blocks, zones).swaps.filter(x => x.to) : [], [blocks, zones.join()])
  async function saveTpl() {
    const name = f.title.trim() || prompt('Nom du modèle ?'); if (!name) return
    try { await api.journal.add({ kind: 'workout', day: todayISO(), data: { name, blocks } }); tpls.reload(); toast('Modèle enregistré dans la bibliothèque') } catch (e) { toast('Enregistrement impossible : ' + e.message) }
  }
  async function create(mode) {
    setErr('')
    if (!blocks.length || !nSteps) return setErr('Ajoutez au moins un exercice')
    if (f.format === 'duo' && !team) return setErr('Choisissez votre duo')
    if (!f.date) return setErr('Choisissez une date')
    const bl = blocks.map(b => isGroup(b) ? { ...b, w: team ? b.w || 'A' : 'A' } : { ...b, sets: Math.max(1, +b.sets || 1), w: team ? b.w : 'A' })
    try {
      if (editing) {   // séance prévue modifiée : même séance, nouveaux exercices
        await api.sessions.save({ id: editing.id, team_id: team ? team.id : null, session_date: f.date, name: f.title.trim() || editing.name, athletes: team ? slotsOf(team) : { A: user.id, B: null },
          names: { A: names.A, B: team ? names.B : null }, data: { ...emptyCustom(bl, f.title.trim()), ...(editing.data.planDay ? { planDay: editing.data.planDay } : {}) } })
        await reload(['sessions'])
        if (mode === 'plan') { toast('Séance modifiée'); go('#/seances', true) } else go('#/seance/' + editing.id + (mode === 'live' ? '/chrono' : '/temps'), true)
        return
      }
      const s = await api.sessions.save({ owner: user.id, team_id: team ? team.id : null, kind: 'entrainement', session_date: f.date,
        name: f.title.trim() || 'Séance du ' + frDate(f.date).slice(0, 5), athletes: team ? slotsOf(team) : { A: user.id, B: null },
        names: { A: names.A, B: team ? names.B : null }, timekeeper: f.keeper, plan: null, data: { ...emptyCustom(bl, f.title.trim()), ...(q.get('plan') ? { planDay: q.get('plan') } : {}) } })
      await reload(['sessions'])
      if (mode === 'plan') { toast('Séance planifiée le ' + frDate(f.date)); go(q.get('back') || '#/seances', true) }
      else go('#/seance/' + s.id + (mode === 'live' ? '/chrono' : '/temps'), true)
    } catch (e) { setErr(e.message) }
  }
  return <Page back={q.get('back') || '#/seances'} title={editing ? 'Modifier la séance' : 'Séance personnalisée'} subtitle={editing ? 'Séance prévue le ' + frDate(editing.session_date) + ' : changez les exercices, la date ou le titre.' : 'Renfo, course, ateliers, circuits… avec vos objectifs. Planifiez-la ou lancez-la tout de suite.'}>
    <button className="btn tinted block" onClick={() => setLib(true)}><Icon name="cal" size={18} />Bibliothèque : séances types et mes modèles</button>
    <h2 className="sec">Séance</h2>
    <Seg value={f.format} onChange={v => setF({ ...f, format: v })} options={[['solo', 'Solo'], ['duo', 'Duo']]} />
    <List>
      <Field label="Titre"><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Renfo bas du corps" /></Field>
      {f.format === 'duo' && <Field label="Duo"><select value={f.team} onChange={e => setF({ ...f, team: e.target.value })}>{mine.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
      <Field label="Date" sub={future ? 'Séance planifiée : elle apparaîtra dans votre programme ce jour-là' : null}><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
    </List>
    <h2 className="sec">Exercices et objectifs <span className="faint small">· {nSteps} étape(s)</span></h2>
    {painSwaps.length > 0 && <div className="note small">Douleur déclarée : {painSwaps.length} exercice(s) la sollicitent. <button className="btn tinted small" onClick={() => setBlocks(adaptBlocks(blocks, zones).blocks)}>Tout adapter</button></div>}
    {blocks.map((b, i) => <div key={i + (b.fmt || b.ex)} data-blk={i} className="glass" style={{ borderRadius: 18, marginBottom: 10, overflow: 'hidden', outline: drag === i ? '2px solid var(--accent)' : 'none', transform: drag === i ? 'scale(1.01)' : 'none', transition: 'transform .1s' }}>
      <div className="tiny" style={{ padding: '8px 14px 0', fontWeight: 700, letterSpacing: '.04em', color: isGroup(b) ? 'var(--accent)' : 'var(--ink-3)' }}>{isGroup(b) ? 'BLOC · ' + (FORMATS[b.fmt] || {}).label.toUpperCase() : 'EXERCICE ' + (i + 1)}</div>
      {isGroup(b)
        ? <GroupEditor b={b} i={i} n={blocks.length} duo={!!team} names={names} zones={zones} onChange={x => upd(i, x)} onMove={d => move(i, d)} onDel={() => setBlocks(L => L.filter((_, k) => k !== i))} onDrag={e => startDrag(i, e)} />
        : <BlockEditor b={b} i={i} n={blocks.length} duo={!!team} names={names} zones={zones} onChange={x => upd(i, x)} onMove={d => move(i, d)} onDel={() => setBlocks(L => L.filter((_, k) => k !== i))} onDrag={e => startDrag(i, e)} />}
    </div>)}
    <List>
      <Row icon="plus" color="#30d158" title="Ajouter un exercice" sub="Séries, répétitions, charge, RIR, tempo…" onClick={() => setBlocks(L => [...L, newBlock(L.length && !isGroup(L[L.length - 1]) ? L[L.length - 1].ex : 'squat')])} />
      <Row icon="timer" color="#5e5ce6" title="Ajouter un bloc" sub="Circuit, superset, EMOM, AMRAP, Tabata, intervalles" onClick={() => setAdding(a => !a)} />
      {adding && <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{Object.entries(FORMATS).map(([k, F]) => <button key={k} className="btn glass small" onClick={() => { setBlocks(L => [...L, newGroup(k)]); setAdding(false) }}>{F.label}</button>)}</div>}
    </List>
    <p className="foot">Seules les mesures utiles à chaque exercice sont proposées (« + mesure » pour en ajouter). RIR = répétitions gardées en réserve. Les Tabata et intervalles s’enchaînent automatiquement dans le chrono.</p>
    <h2 className="sec">Qui enregistre les temps ?</h2>
    <KeeperPicker value={f.keeper} onChange={k => setF({ ...f, keeper: k })} exclude={[user.id]} />
    {err && <p className="err">{err}</p>}
    {future
      ? <><button className="btn block" style={{ marginTop: 16 }} onClick={() => create('plan')}><Icon name="cal" size={18} />{editing ? 'Enregistrer (le ' + frDate(f.date).slice(0, 5) + ')' : 'Planifier le ' + frDate(f.date).slice(0, 5)}</button>
        <button className="btn glass block" style={{ marginTop: 8 }} onClick={saveTpl}>Enregistrer comme modèle</button></>
      : <><button className="btn block" style={{ marginTop: 16 }} onClick={() => create('live')}><Icon name="play" size={18} />Lancer le chrono</button>
        <div className="row-gap" style={{ marginTop: 8 }}>
          <button className="btn glass" style={{ flex: 1 }} onClick={() => create('after')}>Saisir après coup</button>
          <button className="btn glass" style={{ flex: 1 }} onClick={saveTpl}>Enregistrer comme modèle</button>
        </div></>}
    {lib && <LibrarySheet tpls={tpls.data} onClose={() => setLib(false)} onPick={t => { setBlocks(JSON.parse(JSON.stringify(t.blocks))); setF(x => ({ ...x, title: t.name })); setLib(false) }}
      onDelTpl={async id => { if (confirm('Supprimer ce modèle ?')) { await api.journal.remove(id); tpls.reload() } }} />}
  </Page>
}

// ---------------------------------------------------------------- chrono
const buzz = () => { try { navigator.vibrate && navigator.vibrate(180) } catch {} try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const c = buzz.c || (buzz.c = new C()), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.18) } catch {} }
function useNow(on) { const [n, setN] = useState(Date.now()); useEffect(() => { if (!on) return; const t = setInterval(() => setN(Date.now()), 200); return () => clearInterval(t) }, [on]); return n }
function DoneForm({ st, onSave, compact, withTime }) {
  const t = st.target || {}, d0 = st.done || {}
  const [v, setV] = useState({ meters: d0.meters ?? t.meters ?? '', reps: d0.reps ?? (st.ex === 'amrap' ? '' : t.reps ?? ''), load: d0.load ?? t.load ?? '', cal: d0.cal ?? t.cal ?? '', rounds: d0.rounds ?? '', rpe: d0.rpe ?? 7, time: (d0.time ?? doneOf(st).time) != null ? fmt(d0.time ?? doneOf(st).time) : '' })
  const keys = st.ex === 'amrap' ? ['rounds', 'reps'] : ['meters', 'cal', 'reps', 'load'].filter(k => t[k] != null || d0[k] != null)
  // Allure en direct (course : min/km ; rameur, SkiErg, vélo : /500 m)
  const tSec = withTime ? parseT(v.time) : d0.time, m = parseNum(v.meters)
  const pace = tSec > 0 && m > 0 ? (st.ex === 'run' || (EX[st.ex] || {}).cat === 'run' ? fmt(tSec / (m / 1000)) + ' /km' : ['ski', 'row', 'bike'].includes(st.ex) ? fmt(tSec / (m / 500)) + ' /500 m' : null) : null
  const unit = k => k === 'meters' ? ' (m)' : k === 'load' ? ' (kg)' : k === 'cal' ? ' (kcal)' : ''
  return <div>
    {withTime && <label className="tiny muted" style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>Temps réalisé (min:s)<input style={inp} {...TIME} value={v.time} onChange={e => setV({ ...v, time: maskT(e.target.value) })} /></label>}
    {keys.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${keys.length}, 1fr)`, gap: 6 }}>{keys.map(k => <label key={k} className="tiny muted" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{st.ex === 'amrap' && k === 'reps' ? 'Reps en plus' : METRICS[k][0] + unit(k) + ' réalisé(e)'}<input style={inp} inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></label>)}</div>}
    {pace && <div className="small" style={{ marginTop: 6 }}>Allure : <b className="num">{pace}</b>{t.time && t.meters ? <span className="muted"> · visée {fmt(t.time / (t.meters / (st.ex === 'run' ? 1000 : 500)))}</span> : ''}</div>}
    <div className="row-gap small" style={{ marginTop: 6 }}><span>Effort ressenti</span><input type="range" min="1" max="10" value={v.rpe} onChange={e => setV({ ...v, rpe: +e.target.value })} style={{ flex: 1 }} aria-label="Effort ressenti" /><b className="num">{v.rpe}/10</b></div>
    <button className={'btn block ' + (compact ? 'small' : '')} style={{ marginTop: 8 }} onClick={() => onSave({ ...(withTime ? { time: tSec > 0 ? tSec : null } : d0.time != null ? { time: d0.time } : {}), meters: parseNum(v.meters), reps: parseNum(v.reps), load: parseNum(v.load), cal: parseNum(v.cal), rounds: parseNum(v.rounds), rpe: v.rpe })}>Valider</button>
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
  const st = cur >= 0 ? steps[cur] : null, prev = cur > 0 ? steps[cur - 1] : cur < 0 ? steps[steps.length - 1] : null
  const restLeft = st && st.s == null && prev && prev.e != null ? (prev.window ? prev.window - (t - prev.s) / 1000 : prev.rest ? prev.rest - (t - prev.e) / 1000 : null) : null
  const nm = w => w === 'AB' ? 'Les deux' : who(w)
  // Enchaînement automatique (Tabata, intervalles, EMOM, AMRAP) : fin d'effort et départ après la récupération
  const lock = useRef(null)
  useEffect(() => {
    if (!started || finished || !st) return
    const key = cur + ':' + (st.s == null ? 's' : 'e')
    if (lock.current === key) return
    if (st.s != null && st.e == null && st.auto && st.target.time && (t - st.s) / 1000 >= st.target.time) {
      lock.current = key; buzz(); const x = cl(); x.steps[cur].e = st.s + st.target.time * 1000; commit(x)
    } else if (st.s == null && st.autoStart && prev && prev.e != null && restLeft != null && restLeft <= 0) {
      lock.current = key; buzz(); const x = cl(); x.steps[cur].s = prev.window ? prev.s + prev.window * 1000 : prev.e + (prev.rest || 0) * 1000; commit(x)
    }
  }, [now])
  if (!started) return <div className="glass card center">
    <div className="clock num">0:00</div>
    <p className="muted">{steps.length} étape(s) : {[...new Set(steps.map(exLabel))].join(', ')}</p>
    <button className="btn green block" style={{ minHeight: 70, fontSize: 20 }} onClick={() => commit({ ...cl(), startedAt: Date.now() })}><Icon name="play" />Départ</button>
  </div>
  return <>
    <div className="glass card">
      <div className="clock num">{fmt(finished ? customSummary(s).total : t / 1000)}</div>
      <div className="progress"><i style={{ width: ((cur < 0 ? steps.length : cur) / steps.length * 100) + '%' }} /></div>
      {st ? <>
        {st.grp && <div className="badge accent" style={{ marginBottom: 4 }}>{st.grp.label}{st.auto || st.autoStart ? ' · enchaînement automatique' : ''}</div>}
        <div className="cur">{stepLabel(st)}</div>
        <div className="cur-sub">Objectif : {st.hold && st.target.time ? (st.ex === 'amrap' ? 'max de tours en ' + fmt(st.target.time) + (st.target.rounds ? ' (visez ' + st.target.rounds + ')' : '') : fmtTarget({ ...st.target, time: null }).replace('—', 'effort') + ' en ' + fmt(st.target.time)) : fmtTarget(st.target)}{st.tempo ? ' · tempo ' + st.tempo : ''}{hasB(s) ? ' · ' + nm(st.w) : ''}{st.note ? ' · ' + st.note : ''}</div>
        {steps[cur + 1] && <div className="tiny muted center">Ensuite : {stepLabel(steps[cur + 1])}</div>}
        {st.s == null ? <>
          {restLeft != null && <div className={'center num ' + (restLeft > 0 ? '' : 'good')} style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>{restLeft > 0 ? 'Récup ' + fmt(restLeft) : 'C’est reparti !'}</div>}
          <div className="pad"><button className="btn green full" onClick={() => { const x = cl(); x.steps[cur].s = rel(); commit(x) }}><Icon name="play" />Démarrer<small>{exLabel(st)}</small></button></div>
        </> : <>
          <div className="center num" style={{ fontSize: 34, fontWeight: 700 }}>{st.auto && st.target.time ? <>{fmt(Math.max(0, st.target.time - (t - st.s) / 1000))}<span className="muted small"> restant</span></> : <>{fmt((t - st.s) / 1000, true)}{st.target.time ? <span className="muted small"> / {fmt(st.target.time)}</span> : ''}</>}</div>
          {st.window && <div className="center small muted">Minute en cours : {fmt(Math.max(0, st.window - (t - st.s) / 1000))} avant la suivante</div>}
          <div className="pad" style={{ marginTop: 10 }}><button className="btn red full" onClick={() => { const x = cl(); x.steps[cur].e = rel(); commit(x) }}>Terminé<small>enregistrer le temps</small></button></div>
        </>}
      </> : <div className="center"><div className="cur">Séance terminée</div><div className="cur-sub">Durée totale {fmt(customSummary(s).total)}</div>
        <a className="btn" href={'#/seance/' + s.id + (keeperOnly ? '/temps' : '/stats')}>{keeperOnly ? 'Voir les résultats' : 'Voir l’analyse'}</a>
        {!keeperOnly && <div className="row-gap" style={{ marginTop: 8, justifyContent: 'center' }}><a className="btn glass small" href="#/moi/programme"><Icon name="cal" size={14} />Programme</a><a className="btn glass small" href="#/moi/etirements"><Icon name="leaf" size={14} />Étirements</a><a className="btn glass small" href="#/moi/sante?t=forme"><Icon name="spark" size={14} />Forme</a></div>}</div>}
    </div>
    {pendingDone >= 0 && <div className="glass card"><div className="small" style={{ marginBottom: 6 }}><b>{stepLabel(steps[pendingDone])}</b> en {fmt(doneOf(steps[pendingDone]).time)} : qu’avez-vous réalisé ?</div>
      <DoneForm key={pendingDone} st={steps[pendingDone]} compact onSave={v => { const x = cl(); x.steps[pendingDone].done = v; commit(x) }} /></div>}
    <div className="row-gap"><button className="btn glass small" disabled={!canUndo} onClick={undo}><Icon name="undo" size={16} />Annuler</button><span className="spacer" />
      {st && <button className="btn plain small" onClick={() => { const x = cl(); const k = cur; if (x.steps[k].s == null) x.steps[k].s = rel(); x.steps[k].e = x.steps[k].s; x.steps[k].done = { skipped: true }; commit(x) }}>Passer l’étape</button>}
      <span className="small muted">Étape {Math.min(steps.length, cur < 0 ? steps.length : cur + 1)}/{steps.length}</span></div>
    <List>{steps.map((x, i) => { const dn = doneOf(x), a = achievement(x); return <Row key={i} title={stepLabel(x)} sub={'Objectif ' + fmtTarget(x.target)} value={x.e != null ? <span className={a == null ? '' : a >= 1 ? 'good' : a < 0.9 ? 'bad' : 'even'}>{fmt(dn.time)}{a != null ? ' · ' + pct(a) : ''}</span> : i === cur ? '…' : ''} /> })}</List>
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
      <Row title={stepLabel(x)} sub={`Objectif ${fmtTarget(x.target)} · réalisé ${fmtTarget(dn)}${pc ? ' · ' + (pc.rate ? pc.v.toFixed(1).replace('.', ',') : fmt(pc.v)) + ' ' + pc.u : ''}${dn.rpe ? ' · effort ' + dn.rpe + '/10' : ''}`}
        value={<span className={a == null ? 'faint' : a >= 1 ? 'good' : a < 0.9 ? 'bad' : 'even'}>{pct(a)}</span>} onClick={() => setOpen(open === i ? null : i)} />
      {open === i && <div className="row stack" style={{ background: 'var(--fill)' }}>
        <DoneForm st={x} withTime onSave={v => { setDone(i, v); setOpen(null) }} />
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
  const slots = hasB(s) ? ['A', 'B'] : ['A']
  const prof = w => { const id = s.athletes[w]; if (id === profile.id) return profile; for (const t of teams) { const m = t.members.find(x => x.user_id === id); if (m) return m.profile } return null }
  const get = w => (rows.data || []).find(r => r.user_id === s.athletes[w])
  const meSlot = s.athletes.A === profile.id ? 'A' : s.athletes.B === profile.id ? 'B' : 'A'
  const by = get(meSlot) ? hrBySteps(s, get(meSlot)) : {}
  const zones = zonesOf(prof(meSlot))
  const prog = progression(s, by, zones)
  const S = get(meSlot) ? series(get(meSlot)) : null
  const end = customEnd(d) / 1000
  const all = S ? hrStat(S, 0, end) : null
  const kcal = all ? kcalFromHR(all.avg, end / 60, prof(meSlot)) : d.avgHR ? kcalFromHR(d.avgHR, end / 60, prof(meSlot)) : kcalFromMET(steps.filter(x => x.w === meSlot || x.w === 'AB'), prof(meSlot))
  const z = [0, 0, 0, 0, 0]; let n = 0
  if (S) for (let t = 0; t <= end; t++) { const v = hrAt(S, t); if (v != null) { z[zoneOf(zones, v) - 1]++; n++ } }
  const bands = steps.filter(x => x.s != null && x.e != null).map(x => ({ a: x.s / 1000, b: x.e / 1000, color: hasB(s) ? COLORS[x.w === 'B' ? 'B' : 'A'] : '#5e5ce6' }))
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
      {steps.map((x, i) => { const dn = doneOf(x), a = achievement(x), h = by[i]; return <tr key={i}><td>{stepLabel(x)}</td><td className="r small">{fmtTarget(x.target)}</td><td className="r small">{fmtTarget(dn)}</td>
        <td className={'r num ' + (a == null ? 'faint' : a >= 1 ? 'good' : a < 0.9 ? 'bad' : 'even')}>{pct(a)}</td><td className="r num">{h ? Math.round(h.avg) + ' / ' + h.max : '—'}</td></tr> })}
    </tbody></table></div>
    <h2 className="sec">Objectifs proposés pour la prochaine fois</h2>
    <List>{prog.map((p, i) => <div className="row stack" key={i}><div className="row-gap"><b>{p.label}</b><span className="spacer" /><span className={'badge ' + (p.achievement >= 1 ? 'good' : p.achievement < 0.9 ? 'bad' : '')}>{pct(p.achievement)}</span></div>
      <span className="small">{fmtTarget(p.target)} → <b>{fmtTarget(p.next)}</b></span><span className="small muted">{p.why}{p.e1rm ? ` · 1RM estimé ${Math.round(p.e1rm)} kg` : ''}{p.hmax ? ` · FC max ${p.hmax}` : ''}</span></div>)}</List>
    <StretchSuggest s={s} />
    <p className="foot">Les ateliers Hyrox et la course réalisés ici alimentent aussi vos temps prédits (comptés à 70 %, car effectués « à frais », hors enchaînement), le programme et la dépense du jour dans le coach nutrition.</p>
  </>
}
