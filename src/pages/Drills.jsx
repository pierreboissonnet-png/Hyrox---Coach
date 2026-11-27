// Fiches atelier : point faible de chaque station, exercices ciblés, séance prête à lancer, test et courbe de progression.
import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Chips, Empty, Icon, useLoad } from '../ui.jsx'
import { LineChart } from '../charts.jsx'
import { fmt, frDate, STATION } from '../lib/hyrox.js'
import { gapsOf } from '../lib/gaps.js'
import { isCustom, isPlanned, expand, stepLabel, fmtTarget, rpeOf, EX } from '../lib/custom.js'
import { addDays } from '../lib/plan.js'
import { usePlanData } from './Plan.jsx'
import { DRILLS, DRILL_ORDER, diagnose, priority, drillCtx, drillSession, drillResults } from '../lib/drills.js'

const ICON = { run: 'flag', ski: 'bolt', row: 'bolt', push: 'bolt', pull: 'bolt', burp: 'bolt', farm: 'bolt', lunge: 'bolt', wb: 'bolt' }
const COL = s => s >= 1.2 ? '#ff375f' : s >= 0.6 ? '#ff9f0a' : s > 0 ? '#ffd60a' : '#30d158'

/** Signaux par station : bilan, lacune calculée, perte sous fatigue (série 2 / 2e moitié), ressenti */
function useSignals() {
  const { sessions, profile } = useApp()
  const P = usePlanData()
  const lv = useLoad(() => api.journal.list('level'), [])
  const self = (((lv.data || [])[0] || {}).data || {}).self || {}
  const calc = useMemo(() => P.ready ? gapsOf(P.an.mine, { profile, e1rm: P.ins.e1rm }) : [], [P.ready, P.an.mine])
  const since = addDays(new Date().toISOString().slice(0, 10), -60)
  const mine = useMemo(() => sessions.filter(s => isCustom(s) && !isPlanned(s) && s.session_date >= since && s.athletes && (s.athletes.A === profile.id || s.athletes.B === profile.id)), [sessions])
  const sig = useMemo(() => Object.fromEntries(DRILL_ORDER.map(st => {
    // perte sous fatigue : même exercice fait 2 fois dans une séance (tours), dernière séance qui le contient
    let drop = null, rp = []
    mine.forEach(s => {
      const slot = s.athletes.A === profile.id ? 'A' : 'B'
      const L = (s.data.steps || []).filter(x => x.ex === st && (x.w === slot || x.w === 'AB') && x.s != null && x.e != null)
      L.forEach(x => { const r = rpeOf(x.done, slot); if (r != null) rp.push(r) })
      if (L.length >= 2) { const a = (L[0].e - L[0].s), b = (L[L.length - 1].e - L[L.length - 1].s); if (a > 0) drop = Math.max(drop ?? -1, b / a - 1) }
    })
    const gap = calc.find(g => (st === 'run' ? g.id === 'run' : g.st === st))
    const S = st === 'run' ? self.run : self[st]
    return [st, { self: S, gap, drop, rpe: rp.length ? rp.reduce((a, b) => a + b, 0) / rp.length : null }]
  })), [mine, calc, self])
  return { ready: P.ready && !lv.loading, sig, P, profile, sessions }
}

export function DrillsPage() {
  const { ready, sig } = useSignals()
  if (!ready) return <Page back="#/moi" title="Fiches atelier"><p className="muted">Chargement…</p></Page>
  const L = DRILL_ORDER.map(st => { const D = diagnose(st, sig[st]); return { st, D, p: priority(D) } }).sort((a, b) => b.p - a.p)
  return <Page back="#/moi" title="Fiches atelier" subtitle="Pour chaque station : ce qui vous limite, des exercices vraiment ciblés, un test pour mesurer.">
    <Sec title="Par priorité" foot="Priorité calculée d’après votre bilan « Mon niveau », vos temps par rapport aux repères, la perte sous fatigue (2e tour) et votre ressenti. Mettez à jour « Mon niveau » pour affiner.">
      <List>{L.map(({ st, D, p }) => <Row key={st} icon={st === 'run' ? 'flag' : 'bolt'} color={COL(p)} title={DRILLS[st].label}
        sub={p > 0 ? 'À travailler : ' + D.filter(f => f.score > 0).slice(0, 2).map(f => f.label.toLowerCase()).join(', ') + ' · ' + D[0].why[0] : 'Pas de point faible repéré : maintien, ou choisissez un axe'}
        value={p >= 1.2 ? 'haute' : p >= 0.6 ? 'moyenne' : p > 0 ? 'faible' : ''} href={'#/moi/ateliers/' + st} />)}</List>
    </Sec>
  </Page>
}

export function DrillPage({ st }) {
  const { ready, sig, P, profile, sessions } = useSignals()
  const D = DRILLS[st]
  const diag = useMemo(() => ready && D ? diagnose(st, sig[st]) : [], [ready, sig])
  const [pick, setPick] = useState(null)
  if (!D) return <Page back="#/moi/ateliers" title="Fiche atelier"><Empty>Atelier inconnu.</Empty></Page>
  if (!ready) return <Page back="#/moi/ateliers" title={D.label}><p className="muted">Chargement…</p></Page>
  const auto = diag.filter(f => f.score > 0).slice(0, diag[1] && diag[1].score >= diag[0].score * 0.7 ? 2 : 1).map(f => f.id)
  const sel = pick || (auto.length ? auto : [D.factors[0].id])
  const ctx = drillCtx(st, { profile, e1rm: P.ins.e1rm, pace: P.an.pace })
  const ses = drillSession(st, sel, ctx)
  const steps = expand(ses.blocks)
  const min = Math.round(steps.reduce((a, x) => a + (x.target.time || (x.target.meters ? x.target.meters * ({ run: 0.33, ski: 0.25, row: 0.25, bike: 0.12, farm: 0.6, burp: 2.5, push: 3, pull: 4, lunge: 2.5, sledrow: 3 }[x.ex] || 1) : (x.target.reps || 10) * 3)) + (x.rest || 0), 0) / 60)
  const res = drillResults(sessions, profile.id, st)
  const test = D.test(ctx)
  const go = (blocks, title, extra) => { try { localStorage.setItem('hx-prefill', JSON.stringify({ blocks, title, extra })) } catch {} location.hash = '#/seance/specifique?back=' + encodeURIComponent('#/moi/ateliers/' + st) }
  const toggle = id => { const cur = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]; setPick(cur.length ? cur : [id]) }
  const s0 = sig[st] || {}
  return <Page back="#/moi/ateliers" title={D.label} subtitle={'Format de course : ' + D.unit + (ctx.L ? ' · charge ' + ctx.L + ' kg' + (st === 'farm' ? ' par main' : '') : '')}>
    <Sec title="Ce qui vous limite">
      <div className="glass card">
        {diag.filter(f => f.score > 0).length ? diag.filter(f => f.score > 0).map(f => <div key={f.id} className="tip"><span className="dot" style={{ background: COL(f.score) }} /><span className="small"><b>{f.label}</b> : {f.why.join(' ; ')}</span></div>)
          : <p className="small muted" style={{ margin: 0 }}>Rien de saillant dans vos données. Indiquez votre ressenti sur cet atelier dans « Mon niveau » ou choisissez un axe ci-dessous.</p>}
        {s0.drop != null && s0.drop < 0.08 && <div className="tiny muted" style={{ marginTop: 4 }}>Sous fatigue, vous tenez bien ({s0.drop >= 0 ? '+' : ''}{Math.round(s0.drop * 100)} % au 2e tour).</div>}
        <a className="btn plain small" style={{ padding: '4px 0', marginTop: 4 }} href="#/moi/niveau">Mettre à jour mon ressenti (Mon niveau)</a>
      </div>
    </Sec>
    <Sec title="Axe à travailler">
      <Chips value={null} onChange={toggle} label="Axes" options={D.factors.map(f => [f.id, (sel.includes(f.id) ? '✓ ' : '') + f.label])} />
      {D.factors.filter(f => sel.includes(f.id)).map(f => <div key={f.id} className="glass card" style={{ marginTop: 8 }}>
        <b>{f.label}</b><div className="small muted" style={{ marginTop: 2 }}>Signes : {f.signs}</div>
        <div style={{ marginTop: 6 }}>{f.cues.map((c, i) => <div key={i} className="tip"><span className="dot good" /><span className="small">{c}</span></div>)}</div>
      </div>)}
    </Sec>
    <Sec title={'Séance ciblée · ≈ ' + min + ' min'} foot="Charges proposées d’après la charge de course et vos 1RM estimés : ajustez-les avant de lancer. À faire 1 à 2 fois par semaine, par exemple dans un créneau renfo du programme.">
      <List>{ses.blocks.map((b, i) => {
        const items = b.type === 'group' ? b.items : [b]
        const head = b.type === 'group' ? ({ emom: `EMOM ${b.minutes} min`, interval: `${b.rounds} × ${b.work} s effort / ${b.rest} s récup`, circuit: `Circuit ${b.rounds} tours`, tabata: 'Tabata', superset: `Superset ${b.rounds} tours` }[b.fmt] || 'Bloc') : null
        return <div className="row stack" key={i}>
          {head && <span className="badge accent" style={{ alignSelf: 'flex-start' }}>{head}</span>}
          {items.map((x, k) => <div key={k}><b>{x.name || (EX[x.ex] || {}).label || x.ex}</b> <span className="small">{b.type === 'group' ? fmtTarget(x.target) : `${b.setTargets ? b.setTargets.map(t => t.reps).join('-') + ' reps · ' + fmtTarget({ ...b.target, reps: null }) : (b.sets > 1 ? b.sets + ' × ' : '') + fmtTarget(b.target)}${b.tempo ? ' · tempo ' + b.tempo : ''}${b.rest ? ' · récup ' + fmt(b.rest) : ''}`}</span>
            {x.note && <div className="small muted">{x.note}</div>}</div>)}
        </div> })}</List>
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => go(ses.blocks, ses.title, { drill: ses.drill })}><Icon name="play" size={18} />Préparer cette séance</button>
      <p className="tiny muted center" style={{ marginTop: 4 }}>Elle s’ouvre dans l’éditeur : lancez-la tout de suite ou choisissez une date.</p>
    </Sec>
    <Sec title="Test et progression" foot={`Refaites le test toutes les 3 à 4 semaines, à la même charge. La courbe reprend aussi vos ${D.unit} complets faits en séance perso (en duo : temps de l’atelier à deux).`}>
      {res.length > 1 ? <div className="glass card">
        <LineChart height={150} invert yFmt={v => fmt(v)} xFmt={v => frDate(new Date(v * 864e5).toISOString().slice(0, 10)).slice(0, 5)}
          series={[{ color: '#0a84ff', dots: true, width: 2, pts: res.filter(r => !r.duo).map(r => [Date.parse(r.date) / 864e5, r.t]) }, { color: '#ff9f0a', dots: true, width: 2, dash: '4 3', pts: res.filter(r => r.duo).map(r => [Date.parse(r.date) / 864e5, r.t]) }].filter(x => x.pts.length)} />
        <div className="legend"><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#0a84ff', marginRight: 4 }} />Seul</span>{res.some(r => r.duo) && <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#ff9f0a', marginRight: 4 }} />En duo</span>}<span className="faint">temps rapides en haut</span></div>
        <div className="small" style={{ marginTop: 4 }}>Dernier : <b className="num">{fmt(res[res.length - 1].t)}</b> le {frDate(res[res.length - 1].date)} · meilleur <b className="num">{fmt(Math.min(...res.map(r => r.t)))}</b></div>
      </div> : res.length === 1 ? <div className="glass card small">Un résultat : <b className="num">{fmt(res[0].t)}</b> le {frDate(res[0].date)}{res[0].duo ? ' (en duo)' : ''}. Refaites le test pour voir la courbe.</div>
        : <div className="glass card small muted">Pas encore de résultat sur {D.unit}. Faites le test une première fois : c’est votre point de départ.</div>}
      <button className="btn glass block" style={{ marginTop: 10 }} onClick={() => go(test.blocks, test.title, { drillTest: st })}><Icon name="timer" size={18} />{test.title}</button>
    </Sec>
  </Page>
}
