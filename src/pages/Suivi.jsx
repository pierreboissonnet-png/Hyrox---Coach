// Suivi de l'entraînement : tout ce qui a été fait face au plan et au diagnostic, semaine après semaine.
import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Stat, Chips, Empty, useLoad } from '../ui.jsx'
import { LineChart, COLORS } from '../charts.jsx'
import { fmt, frDate } from '../lib/hyrox.js'
import { addDays } from '../lib/plan.js'
import { EX } from '../lib/custom.js'
import { usePlanData } from './Plan.jsx'
import { weekly, skipped, gapWork, progressExercises, progressPoints } from '../lib/suivi.js'

const exName = id => (EX[id] || {}).label || id
const n1 = v => v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',')

export function SuiviPage() {
  const { profile } = useApp()
  const P = usePlanData(), { plan, doneOn, today, an } = P
  const health = !!profile.consent_health
  const wb = useLoad(() => health ? api.journal.list('wellbeing') : [], [])
  const sl = useLoad(() => health ? api.journal.list('sleep') : [], [])
  const [range, setRange] = useState('8')
  const [ex, setEx] = useState(null)
  const from = useMemo(() => {
    if (range === 'plan' && plan && plan.created) return plan.created
    return addDays(today, -7 * (+range || 8) + 1)
  }, [range, plan, today])
  const W = useMemo(() => weekly({ sessions: P.sessions, plan, doneOn, wellbeing: wb.data || [], vitals: P.vitals, sleep: sl.data || [], from, today }), [P.sessions, plan, wb.data, sl.data, P.vitals, from, P.manual])
  const skip = useMemo(() => skipped({ plan, doneOn, from, today }).reverse(), [plan, from, P.manual, P.byDate])
  const gw = useMemo(() => gapWork({ gaps: an.gaps, plan, sessions: P.sessions, from, today }), [an.gaps, plan, P.sessions, from])
  const exs = useMemo(() => progressExercises(P.sessions), [P.sessions])
  const cur = ex && exs.includes(ex) ? ex : exs[0]
  const prog = useMemo(() => cur ? progressPoints(P.sessions, cur) : null, [P.sessions, cur])
  if (!P.ready) return <Page back="#/moi" title="Suivi de l’entraînement"><p className="muted">Chargement…</p></Page>

  const tot = W.reduce((a, w) => ({ min: a.min + w.min, planMin: a.planMin + w.planMin, km: a.km + w.km, n: a.n + w.n, due: a.due + w.due, done: a.done + w.done, stretch: a.stretch + w.stretch }), { min: 0, planMin: 0, km: 0, n: 0, due: 0, done: 0, stretch: 0 })
  const adh = tot.due ? tot.done / tot.due : null
  const maxMin = Math.max(60, ...W.map(w => Math.max(w.min, w.planMin)))
  // courbe cumulée : séances prévues (échues) vs validées
  let cp = 0, cd = 0
  const cum = W.map((w, i) => { cp += w.due; cd += w.done; return [i, cp, cd] })
  const xl = v => (W[Math.round(v)] || {}).label || ''
  const hasForm = W.some(w => w.fatigue != null || w.rhr != null || w.sleepH != null || w.hrv != null)

  return <Page back="#/moi" title="Suivi de l’entraînement" subtitle="Ce que vous avez fait, face au plan et à votre diagnostic.">
    <Chips value={range} onChange={setRange} label="Période" options={[['4', '4 semaines'], ['8', '8 semaines'], ['12', '12 semaines'], ...(plan && plan.created ? [['plan', 'Depuis le début du plan']] : [])]} />
    <div className="stats">
      <Stat k="Séances faites" v={tot.n} d={tot.stretch ? '+ ' + tot.stretch + ' étirements' : ''} />
      <Stat k="Assiduité au plan" v={adh != null ? Math.round(adh * 100) + ' %' : '—'} d={plan ? tot.done + '/' + tot.due + ' séances prévues' : 'pas de plan actif'} tone={adh == null ? '' : adh >= 0.8 ? 'good' : adh >= 0.6 ? 'even' : 'bad'} />
      <Stat k="Volume" v={n1(tot.min / 60) + ' h'} d={tot.planMin ? 'prévu ' + n1(tot.planMin / 60) + ' h' : ''} />
      <Stat k="Course" v={n1(tot.km) + ' km'} d={W.length ? n1(tot.km / W.length) + ' km/sem.' : ''} />
    </div>

    <Sec title="Volume par semaine" foot="Barre pleine : minutes réalisées (étirements exclus). Trait : minutes prévues par le plan. Les km courus sont indiqués à droite.">
      <div className="glass card">{W.map(w => <div key={w.ws} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 92px', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
        <span className="muted num">{w.label}</span>
        <span style={{ position: 'relative', height: 14, background: 'var(--fill)', borderRadius: 99 }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (w.min / maxMin * 100) + '%', background: w.planMin && w.min < w.planMin * 0.7 ? 'var(--warn)' : 'var(--accent)', borderRadius: 99 }} />
          {w.planMin > 0 && <span style={{ position: 'absolute', left: (w.planMin / maxMin * 100) + '%', top: -3, bottom: -3, width: 2, background: 'var(--ink-2)' }} />}
        </span>
        <span className="num small" style={{ textAlign: 'right' }}>{n1(w.min / 60)} h{w.km ? ' · ' + n1(w.km) + ' km' : ''}</span>
      </div>)}</div>
    </Sec>

    {plan && <Sec title="Séances faites vs prévues" foot="Cumul depuis le début de la période. Quand la courbe verte s’éloigne de la grise, des séances du plan ont été sautées.">
      <div className="glass card">
        <LineChart height={160} series={[{ color: 'var(--ink-3)', width: 2, dash: '6 4', pts: cum.map(([i, p]) => [i, p]) }, { color: COLORS.C, width: 3, dots: true, pts: cum.map(([i, , d]) => [i, d]) }]} xFmt={xl} yFmt={v => Math.round(v)} yMin={0} />
        <div className="row-gap tiny" style={{ marginTop: 4 }}><span className="row-gap" style={{ gap: 4 }}><span style={{ width: 14, height: 3, background: COLORS.C, display: 'inline-block' }} />faites</span><span className="row-gap" style={{ gap: 4 }}><span style={{ width: 14, borderTop: '2px dashed var(--ink-3)', display: 'inline-block' }} />prévues</span></div>
      </div>
    </Sec>}

    {plan && <Sec title={'Séances sautées' + (skip.length ? ' (' + skip.length + ')' : '')} foot="Une séance faite autrement (cours, activité) se valide dans le programme. Inutile de tout rattraper : le plan se recalcule chaque semaine.">
      {skip.length ? <List>{skip.slice(0, 12).map(d => <Row key={d.date + (d.slot || 1)} icon="cal" color="#ff9f0a" title={d.title} sub={d.day + ' ' + frDate(d.date) + (d.min ? ' · ' + d.min + ' min' : '') + (() => { const E = [...new Set((d.blocks || []).flatMap(b => b.type === 'group' ? (b.items || []).map(i => i.ex) : [b.ex]).filter(x => x && x !== 'run'))].slice(0, 3); return E.length ? ' · ' + E.map(exName).join(', ') : '' })()} href="#/moi/programme" />)}
        {skip.length > 12 && <div className="row"><span className="small muted">… et {skip.length - 12} autres</span></div>}</List>
        : <div className="glass card small">Aucune séance du plan sautée sur la période. Bravo !</div>}
    </Sec>}

    <Sec title="Diagnostic : vos points faibles sont-ils travaillés ?" foot="Prévu : séances du plan qui ciblent ce point. Travaillé : séances réalisées où il apparaît (ateliers, course, exercices de force).">
      {gw.length ? <List>{gw.map(g => { const r = g.planned ? g.done / g.planned : null; return <div className="row stack" key={g.id}>
        <div className="row-gap"><b>{g.label}</b><span className="spacer" /><span className={'badge ' + (r == null ? '' : r >= 0.8 ? 'good' : r >= 0.5 ? 'warn' : 'bad')}>travaillé {g.done}× {g.planned ? '/ prévu ' + g.planned + '×' : ''}</span></div>
        <span className="small muted">{g.why}</span>
        {g.planned > 0 && <span style={{ height: 6, background: 'var(--fill)', borderRadius: 99, position: 'relative' }}><span style={{ position: 'absolute', inset: 0, width: Math.min(100, r * 100) + '%', background: r >= 0.8 ? 'var(--good)' : r >= 0.5 ? 'var(--warn)' : 'var(--bad)', borderRadius: 99 }} /></span>}
      </div> })}</List> : <div className="glass card small muted">Pas encore de diagnostic : remplissez « Mon niveau » ou enregistrez une simulation.</div>}
    </Sec>

    <Sec title="Progression par exercice" foot={prog && prog.better === 'up' ? 'Charge maximale par séance : plus haut = mieux.' : 'Temps et allures rapides en haut : plus la courbe monte, plus vous progressez.'}>
      {exs.length ? <>
        <Chips value={cur} onChange={setEx} label="Exercice" options={exs.slice(0, 14).map(id => [id, exName(id)])} />
        {prog && prog.pts.length ? <div className="glass card">
          <div className="small muted" style={{ marginBottom: 4 }}>{exName(cur)} · {prog.unit} · {prog.pts.length} séance(s)</div>
          {prog.pts.length > 1 ? <LineChart height={150} invert={prog.better === 'down'} series={[{ color: COLORS.A, width: 2.5, dots: true, pts: prog.pts.map(([, v], i) => [i, v]) }]} xFmt={v => { const p = prog.pts[Math.round(v)]; return p ? frDate(p[0]).slice(0, 5) : '' }} yFmt={v => prog.time ? fmt(v) : Math.round(v)} />
            : <p className="small" style={{ margin: 0 }}>Une seule mesure pour l’instant : <b>{prog.time ? fmt(prog.pts[0][1]) : prog.pts[0][1] + ' kg'}</b> le {frDate(prog.pts[0][0])}. La courbe apparaît dès la deuxième.</p>}
          {prog.pts.length > 1 && (() => { const a = prog.pts[0][1], b = prog.pts[prog.pts.length - 1][1], d = b - a, good = prog.better === 'up' ? d > 0 : d < 0
            return <p className="small" style={{ marginBottom: 0 }}>Depuis le {frDate(prog.pts[0][0])} : <b className={good ? 'good' : d ? 'bad' : ''}>{prog.time ? (d < 0 ? '−' : '+') + fmt(Math.abs(d)) : (d > 0 ? '+' : '') + Math.round(d) + ' kg'}</b>{good ? ', en progrès.' : d ? ', à surveiller.' : ', stable.'}</p> })()}
        </div> : <div className="glass card small muted">Pas de mesure exploitable pour cet exercice.</div>}
      </> : <div className="glass card"><Empty icon="chart">Les courbes apparaissent après vos premières séances enregistrées.</Empty></div>}
    </Sec>

    {health && <Sec title="Forme et récupération" foot="Moyennes par semaine. Une FC au repos qui monte, une variabilité qui baisse ou une fatigue qui grimpe en même temps que la charge : semaine à alléger.">
      {hasForm ? <div className="glass card">
        {[['Charge (min × effort)', w => w.load || null, COLORS.A, v => Math.round(v)], ['Fatigue (0 à 5)', w => w.fatigue, '#ff9f0a', n1], ['Sommeil (h)', w => w.sleepH, '#5e5ce6', n1], ['FC au repos', w => w.rhr, '#ff375f', v => Math.round(v)], ['Variabilité cardiaque (ms)', w => w.hrv, COLORS.C, v => Math.round(v)]]
          .filter(([, f]) => W.some(w => f(w) != null)).map(([l, f, c, fm]) => <div key={l} style={{ marginBottom: 8 }}>
            <div className="row-gap small"><b>{l}</b><span className="spacer" /><span className="num muted">{fm(f(W[W.length - 1]) ?? f([...W].reverse().find(w => f(w) != null)))}</span></div>
            <LineChart height={70} series={[{ color: c, width: 2, dots: true, pts: W.map((w, i) => [i, f(w)]) }]} xFmt={xl} yFmt={fm} />
          </div>)}
      </div> : <div className="glass card small muted">Saisissez votre forme du jour (Moi › Forme du jour) ou synchronisez votre montre pour voir ces courbes.</div>}
    </Sec>}
  </Page>
}
