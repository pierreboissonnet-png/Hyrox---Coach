// Bilan de niveau : ce que l'on sait déjà de soi (temps de course, ateliers, force) pour un plan juste dès le départ.
import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Field, Seg, Icon, useToast, useLoad, parseNum, TIME } from '../ui.jsx'
import { STATIONS, fmt, parseT, todayISO, frDate } from '../lib/hyrox.js'
import { athleteStats } from '../lib/analyze.js'
import { customInsights } from '../lib/load.js'
import { gapsOf, withLevel } from '../lib/gaps.js'
import { plansOf } from './common.js'

const EXP = [['debut', 'Débutant'], ['inter', 'Intermédiaire'], ['confirme', 'Confirmé']]
const RM = [['squat', 'Squat'], ['deadlift', 'Soulevé de terre'], ['bench', 'Développé couché']]
const tIn = (v, set) => <input {...TIME} defaultValue={v ? fmt(v) : ''} onBlur={e => { const n = parseT(e.target.value); set(n == null || Number.isNaN(n) ? null : n) }} />

export function LevelPage() {
  const { profile, sessions, teams } = useApp(), toast = useToast()
  const j = useLoad(() => api.journal.list('level'), [])
  const cur = (j.data || [])[0]
  if (j.loading) return <Page back="#/moi" title="Mon niveau"><p className="muted">Chargement…</p></Page>
  return <LevelForm key={cur ? cur.id : 'new'} cur={cur} onSaved={() => j.reload()} profile={profile} sessions={sessions} teams={teams} toast={toast} />
}

function LevelForm({ cur, onSaved, profile, sessions, teams, toast }) {
  const d0 = (cur && cur.data) || {}
  const [f, setF] = useState({ exp: d0.exp || 'inter', hours: d0.hours ?? '', run: { ...(d0.run || {}) }, st: { ...(d0.st || {}) }, rm: JSON.parse(JSON.stringify(d0.rm || {})), pdc: { ...(d0.pdc || {}) }, hyrox: { ...(d0.hyrox || {}) } })
  const [busy, setBusy] = useState(false)
  const F = profile.sex === 'F'
  const sub = (k, key, v) => setF(x => ({ ...x, [k]: { ...x[k], [key]: v } }))
  const preview = useMemo(() => {
    const ins = customInsights(sessions, profile.id), W = withLevel(athleteStats(profile.id, sessions, plansOf(teams)), ins.e1rm, { data: f })
    const G = gapsOf(W.stats, { profile, e1rm: W.e1rm, weakSt: ins.weakSt }); return G.filter(g => g.kind !== 'test').slice(0, 4)
  }, [f, sessions])
  async function save() {
    setBusy(true)
    try {
      const data = { ...f, hours: parseNum(f.hours), updated: todayISO() }
      if (cur) await api.journal.update(cur.id, { day: todayISO(), data }); else await api.journal.add({ kind: 'level', day: todayISO(), data })
      toast('Bilan enregistré'); onSaved()
    } catch (e) { toast('Enregistrement impossible : ' + e.message) } finally { setBusy(false) }
  }
  return <Page back="#/moi" title="Mon niveau" subtitle={cur ? 'Bilan du ' + frDate(cur.day) + '. Mettez-le à jour quand vous progressez.' : 'Renseignez ce que vous savez déjà. Tout est facultatif : chaque temps connu affine le plan.'}>
    <div className="note small" style={{ marginTop: 0 }}>Le plan s’appuie d’abord sur vos séances enregistrées ; ce bilan comble ce qu’elles ne disent pas encore. Pas de temps connu ? Faites la séance <a className="link" href="#/seance/specifique?tpl=test-niveau">« Test de niveau »</a> : ses résultats sont pris en compte automatiquement.</div>
    <Sec title="Expérience">
      <Seg value={f.exp} onChange={v => setF({ ...f, exp: v })} options={EXP} />
      <List><Field label="Heures d’entraînement par semaine" sub="En moyenne, ces derniers mois"><input inputMode="decimal" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} placeholder="5" /></Field>
        <Field label="Meilleur temps Hyrox" sub="Si vous en avez déjà fait un"><input {...TIME} placeholder="h:mm:ss" defaultValue={f.hyrox.best ? fmt(f.hyrox.best) : ''} onBlur={e => { const n = parseT(e.target.value); sub('hyrox', 'best', n == null || Number.isNaN(n) ? null : n) }} /></Field>
        {f.hyrox.best && <Field label="Format de ce Hyrox"><select value={f.hyrox.format || 'solo'} onChange={e => sub('hyrox', 'format', e.target.value)}><option value="solo">Solo</option><option value="duo">Duo</option><option value="relay">Relais à 4</option></select></Field>}</List>
    </Sec>
    <Sec title="Course" foot="Temps récents et réalistes, sur du plat.">
      <List><Field label="1 km à fond">{tIn(f.run.k1, v => sub('run', 'k1', v))}</Field>
        <Field label="5 km">{tIn(f.run.k5, v => sub('run', 'k5', v))}</Field></List>
    </Sec>
    <Sec title="Ateliers Hyrox" foot={`Temps pour l’atelier complet, seul(e), au poids de votre catégorie (Open ${F ? 'femme' : 'homme'}). Laissez vide si vous ne savez pas.`}>
      <List>{STATIONS.map(x => <Field key={x.id} label={x.label} sub={x.sub}>{tIn(f.st[x.id], v => sub('st', x.id, v))}</Field>)}</List>
    </Sec>
    <Sec title="Force" foot="Une charge que vous savez soulever, et pour combien de répétitions : le maximum (1RM) est estimé.">
      <List>{RM.map(([k, l]) => <div className="row" key={k}><span className="label"><span className="t">{l}</span>{f.rm[k] && f.rm[k].load ? <span className="s">1RM estimé ≈ {Math.round(f.rm[k].load * (1 + Math.min(+f.rm[k].reps || 1, 12) / 30))} kg</span> : null}</span>
        <input style={{ width: 64 }} inputMode="decimal" placeholder="kg" aria-label={l + ' : charge'} defaultValue={(f.rm[k] || {}).load || ''} onBlur={e => sub('rm', k, { ...(f.rm[k] || {}), load: parseNum(e.target.value) })} />
        <span className="small muted">×</span>
        <input style={{ width: 48 }} inputMode="numeric" placeholder="reps" aria-label={l + ' : répétitions'} defaultValue={(f.rm[k] || {}).reps || ''} onBlur={e => sub('rm', k, { ...(f.rm[k] || {}), reps: parseNum(e.target.value) })} /></div>)}
        <Field label="Tractions" sub="Maximum d’affilée"><input inputMode="numeric" style={{ width: 64 }} defaultValue={f.pdc.pullup ?? ''} onBlur={e => sub('pdc', 'pullup', parseNum(e.target.value))} /></Field>
        <Field label="Pompes" sub="Maximum d’affilée"><input inputMode="numeric" style={{ width: 64 }} defaultValue={f.pdc.pushup ?? ''} onBlur={e => sub('pdc', 'pushup', parseNum(e.target.value))} /></Field>
        <Field label="Wall balls" sub="Maximum d’affilée, poids de votre catégorie"><input inputMode="numeric" style={{ width: 64 }} defaultValue={f.pdc.wb ?? ''} onBlur={e => sub('pdc', 'wb', parseNum(e.target.value))} /></Field>
      </List>
    </Sec>
    <h2 className="sec">Ce que le plan en retient</h2>
    <div className="glass card">{preview.length ? preview.map((g, i) => <div className="tip" key={g.id}><span className={'dot ' + (i === 0 ? 'bad' : 'warn')} /><span className="small"><b>{g.label}</b> : {g.why}.</span></div>) : <div className="small muted">Pas de lacune nette avec ces informations : le plan alternera les ateliers.</div>}</div>
    <button className="btn block" style={{ marginTop: 14 }} disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : cur ? 'Mettre à jour mon bilan' : 'Enregistrer mon bilan'}</button>
    {cur && <a className="btn glass block" style={{ marginTop: 8 }} href="#/moi/programme"><Icon name="cal" size={16} />Voir le programme</a>}
    <p className="foot">Après un bilan, ouvrez le Programme : si vos lacunes ont changé, un lien propose de mettre le plan à jour.</p>
  </Page>
}
