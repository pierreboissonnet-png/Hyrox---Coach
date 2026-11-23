import React, { useMemo, useState } from 'react'
import { QuickSheet } from './Activity.jsx'
import { useApp } from '../App.jsx'
import { Page, Sec, List, Row, Stat, Empty, Icon, Sheet, useLoad } from '../ui.jsx'
import { api, setDemo } from '../lib/api.js'
import { sleepStats, fmtH } from '../lib/sleep.js'
import { Ring } from '../charts.jsx'
import { fmt, fd, frDate, daysUntil, tone } from '../lib/hyrox.js'
import { summary, insights } from '../lib/analyze.js'
import { buildProgram, wellNorm } from '../lib/program.js'
import { trainingLoad } from '../lib/load.js'
import { targets, DAY_TYPES } from '../lib/nutrition.js'
import { gaps as dietGaps } from '../lib/diet.js'
import { NutriGauges } from './Me.jsx'
import { plansOf, upcoming, RACE_TYPE, KIND, activeTeams, partnerOf, isKeeperOnly, athleteNames, mainRace, teamName } from './common.js'
import { normData } from '../lib/session.js'
import { isCustom, customSummary, exLabel, isPlanned, isQuick } from '../lib/custom.js'
import { useTodayPlan } from './Plan.jsx'
import { TrainSheet } from './Train.jsx'
import { todayISO } from '../lib/hyrox.js'

export default function Home() {
  const { profile, races, sessions, teams, loaded } = useApp()
  const ups = upcoming(races), next = ups[0], main = mainRace(races)
  const days = next ? daysUntil(next.race_date) : null, mainDays = main ? daysUntil(main.race_date) : null
  const plans = plansOf(teams)
  const last = sessions.find(s => !isKeeperOnly(s, profile.id, teams) && !isCustom(s))
  const lastCustom = sessions.find(s => !isKeeperOnly(s, profile.id, teams) && isCustom(s) && !isPlanned(s) && !isQuick(s))
  const tp = useTodayPlan()
  const weekDone = useMemo(() => { if (!tp) return { n: 0, done: 0 }; const w = tp.week.days.filter(d => d.key !== 'repos'); return { n: w.length, done: w.filter(d => tp.doneOn(d.date)).length } }, [tp && tp.week, sessions])
  const focus = tp && (tp.gaps || []).find(g => g.kind !== 'test')
  const tl = useMemo(() => trainingLoad(sessions, profile.id), [sessions])
  const rhr = useMemo(() => { const L = (tp && tp.vitals) || []; const e = L.find(x => x.data && x.data.rhr != null); if (!e) return null; const xs = L.filter(x => x !== e && x.data && x.data.rhr != null).slice(0, 28).map(x => x.data.rhr); return { v: e.data.rhr, avg: xs.length >= 3 ? xs.reduce((a, b) => a + b, 0) / xs.length : null } }, [tp && tp.vitals])
  const wb = useLoad(() => profile.consent_health ? api.journal.list('wellbeing') : [], [])
  const wToday = (wb.data || []).find(e => e.day === todayISO()), wn = wToday ? wellNorm(wToday) : null
  const formeScore = wn ? Math.max(wn.fatigue || 0, wn.soreness || 0, 5 - (wn.sleep ?? 5)) : null
  const formeToday = formeScore == null ? null : formeScore >= 4 ? 'Fatigue' : formeScore >= 3 ? 'Moyenne' : 'Bonne'
  const formeTone = formeScore == null ? '' : formeScore >= 4 ? 'bad' : formeScore >= 3 ? 'even' : 'good'
  const lastSim = useMemo(() => sessions.find(s => !isCustom(s) && (s.kind === 'simulation' || s.kind === 'course') && !isKeeperOnly(s, profile.id, teams) && normData(s.data).cp[30] != null), [sessions])
  const lastSimSum = useMemo(() => lastSim ? summary(lastSim, lastSim.plan || plans[lastSim.team_id]) : null, [lastSim])
  const dayId = !tp ? 'entrainement' : tp.d.key === 'repos' ? 'repos' : ['simu', 'compromis', 'seuil', 'allure'].includes(tp.d.key) ? 'intense' : 'entrainement'
  const dietJ = useLoad(() => api.journal.list('diet'), [])
  const dietG = (dietJ.data || [])[0] ? dietGaps((dietJ.data || [])[0].data, profile, dayId) : null
  const nut = targets(profile, dayId), dayLabel = 'journée ' + (DAY_TYPES.find(x => x.id === dayId) || {}).label.toLowerCase()
  const [train, setTrain] = useState(false), [quick, setQuick] = useState(false)
  const plannedToday = sessions.filter(s => isPlanned(s) && s.session_date === todayISO() && !isKeeperOnly(s, profile.id, teams))
  const toKeep = sessions.filter(s => isKeeperOnly(s, profile.id, teams) && (isCustom(s) ? !customSummary(s).complete : normData(s.data).cp[30] == null))
  const sum = useMemo(() => last ? summary(last, last.plan || plans[last.team_id]) : null, [last, teams])
  const tips = sum ? insights(sum) : []
  const today = useMemo(() => {
    const p = buildProgram({ weeks: mainDays != null ? Math.ceil(mainDays / 7) : null, format: main && main.format, weak: sum ? sum.stations.filter(x => x.d > 8).sort((a, b) => b.d - a.d).map(x => x.id) : [] })
    return { p, d: p.days[(new Date().getDay() + 6) % 7] }
  }, [mainDays, sum])
  const myTeams = activeTeams(teams, profile.id)
  const hour = new Date().getHours()
  const sl = useLoad(() => profile.consent_health ? api.journal.list('sleep') : [], [])
  const sst = sleepStats(sl.data || []), lastNight = (sl.data || [])[0]

  const demoBar = api.demo ? <div className="note" style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1 }}><b>Mode démo</b> : données fictives, gardées dans ce navigateur.</span><button className="btn small" onClick={() => setDemo(false)}>Quitter</button></div> : null
  return <Page title={(hour < 18 ? 'Bonjour ' : 'Bonsoir ') + (profile.display_name || '')}>
    {demoBar}
    {next ? <a href="#/courses" className="glass card" style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'inherit', marginTop: 0 }}>
      <div style={{ textAlign: 'center', minWidth: 64 }}><div className="num" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{days === 0 ? 'J' : days}</div><div className="tiny muted">{days === 0 ? 'Jour J' : days > 1 ? 'jours' : 'jour'}</div></div>
      <div style={{ flex: 1, minWidth: 0 }}><div className="tiny" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '.04em' }}>PROCHAINE COURSE</div>
        <div style={{ fontWeight: 600, fontSize: 17 }}>{next.name}</div>
        <div className="muted small">{frDate(next.race_date)}{next.city ? ' · ' + next.city : ''}{next.goal_seconds ? ' · objectif ' + fmt(next.goal_seconds) : ''}</div></div>
      <Icon name="chev" size={16} className="chev" />
    </a> : <a href="#/courses" className="glass card" style={{ display: 'block', color: 'inherit', marginTop: 0 }}><b>Aucune course prévue</b><div className="small muted">Ajoutez votre prochain Hyrox pour construire le plan →</div></a>}

    <div className="glass card" style={{ borderLeft: '4px solid var(--accent)' }}>
      <div className="tiny" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '.04em' }}>AUJOURD’HUI{tp ? ' · ' + tp.phase.label.toUpperCase() : ''}</div>
      {plannedToday.length > 0 ? <>
        <div style={{ fontWeight: 700, fontSize: 19, margin: '2px 0' }}>{plannedToday[0].name}</div><div className="small muted">Séance prévue aujourd’hui</div>
        <div className="row-gap" style={{ marginTop: 10 }}><a className="btn" style={{ flex: 2 }} href={'#/seance/' + plannedToday[0].id + '/chrono'}><Icon name="play" size={18} />Lancer</a><button className="btn glass" style={{ flex: 1 }} onClick={() => setTrain(true)}>Autre</button></div>
      </> : tp ? <>
        <div style={{ fontWeight: 700, fontSize: 19, margin: '2px 0', textDecoration: tp.done && tp.d.key !== 'repos' ? 'line-through' : 'none' }}>{tp.d.title}</div>
        <div className="small muted">{tp.done && tp.d.key !== 'repos' ? '✓ Séance validée. Pensez à la récupération.' : tp.d.detail}</div>
        <div className="row-gap" style={{ marginTop: 10 }}>
          {tp.d.key === 'repos' || tp.done ? <a className="btn" style={{ flex: 2 }} href="#/moi/etirements"><Icon name="leaf" size={18} />Étirements</a>
            : <a className="btn" style={{ flex: 2 }} href="#/moi/programme"><Icon name="play" size={18} />Préparer la séance</a>}
          <button className="btn glass" style={{ flex: 1 }} onClick={() => setTrain(true)}>Autre</button></div>
      </> : <>
        <div style={{ fontWeight: 700, fontSize: 19, margin: '2px 0' }}>{today.d.title}</div><div className="small muted">{today.d.detail}</div>
        <div className="row-gap" style={{ marginTop: 10 }}><a className="btn" style={{ flex: 2 }} href="#/moi/programme"><Icon name="cal" size={18} />Créer mon plan</a><button className="btn glass" style={{ flex: 1 }} onClick={() => setTrain(true)}>S’entraîner</button></div>
      </>}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '4px 0 6px' }}>
      {[['spark', 'Forme', '#30d158', '#/moi/sante?t=forme'], ['plus', 'Activité', '#ff9f0a', null], ['leaf', 'Étirer', '#64d2ff', '#/moi/etirements'], ['heart', 'Nutrition', '#ff375f', '#/moi/nutrition']].map(([ic, l, c, h]) => {
        const inner = <><span style={{ width: 36, height: 36, borderRadius: 11, background: c, color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name={ic} size={19} /></span><span className="tiny" style={{ fontWeight: 600 }}>{l}</span></>
        const st = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px', borderRadius: 16, color: 'inherit', border: 0, font: 'inherit' }
        return h ? <a key={l} className="glass" style={st} href={h}>{inner}</a> : <button key={l} className="glass" style={st} onClick={() => setQuick(true)}>{inner}</button>
      })}
    </div>
    {train && <TrainSheet tp={tp} onClose={() => setTrain(false)} />}
    {quick && <QuickSheet onClose={() => setQuick(false)} />}
    {toKeep.length > 0 && <Sec title="À pointer"><List>{toKeep.map(s => <Row key={s.id} icon="timer" color="#30d158" title={'Pointer ' + (athleteNames(s) || s.name)} sub={s.name} href={'#/seance/' + s.id + '/chrono'} />)}</List></Sec>}
    {tp && <a href="#/moi/programme" className="glass card" style={{ display: 'block', color: 'inherit' }}>
      <div className="row-gap"><b>Ma progression</b><span className="spacer" />{tp.prog && <span className={'badge ' + (tp.prog.status === 'behind' ? 'accent' : tp.prog.status === 'ahead' ? 'good' : '')}>{tp.prog.status === 'behind' ? 'Rythme à ajuster' : tp.prog.status === 'ahead' ? 'En avance' : tp.prog.status === 'race' ? 'À recalculer' : 'Dans les temps'}</span>}<Icon name="chev" size={14} className="chev" /></div>
      {tp.prog && <><div className="small muted" style={{ marginTop: 4 }}>Semaine {tp.wi + 1}/{tp.W} · {tp.phase.label}{tp.raceName ? ' · ' + tp.raceName : ''}</div>
        <div style={{ height: 8, borderRadius: 99, background: 'var(--fill)', margin: '8px 0 4px', position: 'relative', overflow: 'hidden' }}>
          <i style={{ position: 'absolute', inset: 0, width: (tp.prog.total ? tp.prog.doneAll / tp.prog.total * 100 : 0) + '%', background: 'var(--good, #30d158)', borderRadius: 99 }} />
          <i style={{ position: 'absolute', top: 0, bottom: 0, left: ((tp.wi + ((new Date().getDay() + 6) % 7 + 1) / 7) / tp.W * 100) + '%', width: 2, background: 'var(--ink)' }} title="Aujourd’hui" /></div>
        <div className="row-gap tiny muted"><span>{tp.prog.doneAll}/{tp.prog.total} séances du plan{tp.prog.adh != null ? ' · assiduité ' + Math.round(tp.prog.adh * 100) + ' %' : ''}</span><span className="spacer" /><span>cette semaine {weekDone.done}/{weekDone.n}</span></div></>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 8 }}>{tp.week.days.filter(d => (d.slot || 1) === 1).map(d => { const done = tp.doneOn(d.date), rest = d.key === 'repos' || (d.date < (tp.created || '') && !tp.doneOn(d.date)), past = d.date < tp.today, isT = d.date === tp.today
        const bg = done && !rest ? 'var(--good, #30d158)' : rest ? 'var(--fill)' : past ? 'var(--fill)' : 'transparent'
        return <div key={d.date} style={{ textAlign: 'center' }}><div className="tiny muted" style={{ fontWeight: isT ? 800 : 500, color: isT ? 'var(--accent)' : undefined }}>{d.day.slice(0, 1)}</div>
          <div title={d.title} style={{ height: 30, borderRadius: 8, marginTop: 3, background: bg, border: !rest && !done && !past ? '1.5px solid var(--accent)' : isT ? '1.5px solid var(--accent)' : '0', display: 'grid', placeItems: 'center', color: done && !rest ? '#fff' : 'var(--ink-3)', fontSize: 12, fontWeight: 700 }}>{done && !rest ? '✓' : rest ? '' : past ? '×' : (d.zone || '').replace('Z3–Z4', 'Z3')}</div></div> })}</div>
      <div className="small muted" style={{ marginTop: 8 }}>{focus ? <>Focus : <b>{focus.label}</b> · </> : null}charge 7 j : {tl.ratio != null && tl.chronic > 30 ? tl.ratio.toFixed(1).replace('.', ',') + ' × votre moyenne' : Math.round(tl.acute) + ' pts'}</div>
    </a>}
    <a className="btn glass block small" style={{ margin: '8px 0 4px' }} href="#/moi/suivi"><Icon name="chart" size={16} />Suivi de l’entraînement : volume, km, séances sautées, progression</a>

    {profile.consent_health && <><h2 className="sec">Récupération</h2><a href="#/moi/sante?t=forme" style={{ color: 'inherit' }}><div className="stats three">
      <Stat k="Nuit" v={lastNight && lastNight.day >= new Date(Date.now() - 864e5).toISOString().slice(0, 10) ? fmtH(lastNight.data.asleep) : '—'} d={sst ? 'moy. ' + fmtH(sst.avg) : 'à noter'} tone={sst && sst.avg < 420 ? 'bad' : ''} />
      <Stat k="FC repos" v={rhr ? rhr.v : '—'} d={rhr && rhr.avg ? 'moy. ' + Math.round(rhr.avg) + ' bpm' : 'synchro Santé'} tone={rhr && rhr.avg && rhr.v >= rhr.avg + 4 ? 'bad' : ''} />
      <Stat k="Forme" v={formeToday ? formeToday : '—'} d={formeToday ? 'aujourd’hui' : 'à renseigner'} tone={formeTone} />
    </div></a></>}

    {main && <><h2 className="sec">Objectif {main.name}</h2><a href="#/courses" style={{ display: 'block', color: 'inherit' }}>
      <div className="stats">
        <Stat k="Objectif" v={main.goal_seconds ? fmt(main.goal_seconds) : '—'} d={'J−' + mainDays + ' · ' + RACE_TYPE(main)} />
        <Stat k={lastSim ? (lastSim.kind === 'simulation' ? 'Dernière simulation' : 'Dernier Hyrox complet') : 'Référence'} v={lastSim ? fmt(lastSimSum.all.t) : '—'} d={lastSim ? (main.goal_seconds ? fd(lastSimSum.all.t - main.goal_seconds) + ' vs objectif' : frDate(lastSim.session_date)) : 'faites une simulation'} tone={lastSim && main.goal_seconds ? tone(lastSimSum.all.t - main.goal_seconds) : ''} />
      </div></a></>}

    <h2 className="sec">Nutrition du jour · {nut.kcal} kcal, {nut.prot} g de protéines</h2>
    {dietG ? <a href="#/moi/nutrition" style={{ color: 'inherit', display: 'block' }}><NutriGauges G={dietG} day={dayId} limit={6} /></a>
      : <a href="#/moi/nutrition" className="glass card" style={{ display: 'block', color: 'inherit' }}><b>Vos apports face à vos besoins</b><div className="small muted">Décrivez votre alimentation habituelle (2 min) pour voir ici les jauges énergie, protéines, glucides, fer… avec le besoin du jour ({dayLabel.replace('journée ', '')}). →</div></a>}

    {ups.length > 1 && <Sec title="Mes prochains Hyrox">
      <List>{ups.slice(1, 6).map(r => <Row key={r.id} icon="flag" color={r.priority === 'A' ? '#ff375f' : r.format === 'duo' ? '#ff9f0a' : '#0a84ff'} title={r.name} sub={`${frDate(r.race_date)} · ${RACE_TYPE(r)}${r.team_id ? ' · ' + (teamName(teams, r.team_id) || '') : ''}${main && r.id === main.id ? ' · objectif principal' : ''}`} value={'J−' + daysUntil(r.race_date)} href="#/courses" />)}</List>
    </Sec>}

    {myTeams.length > 0 && <Sec title={myTeams.length > 1 ? 'Mes duos' : 'Mon duo'}>
      <List>{myTeams.map(team => <Row key={team.id} icon="team" color="#30d158" title={team.name} sub={partnerOf(team, profile.id) ? 'Avec ' + partnerOf(team, profile.id).profile.display_name : 'En attente du partenaire · code ' + team.invite_code} href={'#/equipe/' + team.id} />)}</List>
    </Sec>}

    {lastCustom && <Sec title="Dernière séance personnalisée"><List>{(() => { const c = customSummary(lastCustom); return <Row icon="bolt" color="#bf5af2" title={lastCustom.name} sub={`${frDate(lastCustom.session_date)} · ${c.done}/${c.n} étapes · ${[...new Set(c.steps.map(exLabel))].slice(0, 3).join(', ')}`} value={c.achievement != null ? Math.round(c.achievement * 100) + ' %' : ''} href={'#/seance/' + lastCustom.id + '/stats'} /> })()}</List></Sec>}
    <Sec title="Dernier Hyrox ou simulation">
      {!loaded ? <p className="muted">Chargement…</p> : !last ? <div className="glass card"><Empty icon="timer">Aucun Hyrox ni simulation enregistré pour l’instant.</Empty>
        <div className="row-gap" style={{ justifyContent: 'center', flexWrap: 'wrap' }}><a className="btn glass small" href="#/seance/nouvelle?apres=1">Ajouter un Hyrox déjà fait</a><a className="btn glass small" href="#/seance/nouvelle">Lancer une simulation</a></div></div> : <>
        <a href={'#/seance/' + last.id + '/stats'} style={{ color: 'inherit' }}>
          <div className="stats">
            <Stat k={last.name} v={fmt(sum.all.t)} d={sum.all.n ? fd(sum.all.d) + ' vs objectif' : KIND[last.kind]} tone={tone(sum.all.d)} />
            <Stat k="Allure course" v={sum.pace ? fmt(sum.pace) + '/km' : '—'} d={frDate(last.session_date)} />
          </div>
        </a>
        {tips.length > 0 && <div className="glass card">{tips.slice(0, 3).map((t, i) => <div className="tip" key={i}><span className={'dot ' + t.tone} /><span className="small">{t.text}</span></div>)}
          <a className="link small" href={'#/seance/' + last.id + '/coach'}>Conseils du coach →</a></div>}
      </>}
    </Sec>
  </Page>
}
