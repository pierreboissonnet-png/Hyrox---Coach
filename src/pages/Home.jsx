import React, { useMemo } from 'react'
import { useApp } from '../App.jsx'
import { Page, Sec, List, Row, Stat, Empty, Icon, useLoad } from '../ui.jsx'
import { api } from '../lib/api.js'
import { sleepStats, fmtH } from '../lib/sleep.js'
import { Ring } from '../charts.jsx'
import { fmt, fd, frDate, daysUntil, tone } from '../lib/hyrox.js'
import { summary, insights } from '../lib/analyze.js'
import { buildProgram } from '../lib/program.js'
import { plansOf, upcoming, RACE_TYPE, KIND, activeTeams, partnerOf, isKeeperOnly, athleteNames } from './common.js'
import { normData } from '../lib/session.js'
import { isCustom, customSummary, exLabel } from '../lib/custom.js'

export default function Home() {
  const { profile, races, sessions, teams, loaded } = useApp()
  const next = upcoming(races)[0]
  const days = next ? daysUntil(next.race_date) : null
  const plans = plansOf(teams)
  const last = sessions.find(s => !isKeeperOnly(s, profile.id, teams) && !isCustom(s))
  const lastCustom = sessions.find(s => !isKeeperOnly(s, profile.id, teams) && isCustom(s))
  const toKeep = sessions.filter(s => isKeeperOnly(s, profile.id, teams) && (isCustom(s) ? !customSummary(s).complete : normData(s.data).cp[30] == null))
  const sum = useMemo(() => last ? summary(last, last.plan || plans[last.team_id]) : null, [last, teams])
  const tips = sum ? insights(sum) : []
  const today = useMemo(() => {
    const p = buildProgram({ weeks: days != null ? Math.ceil(days / 7) : null, format: next && next.format, weak: sum ? sum.stations.filter(x => x.d > 8).sort((a, b) => b.d - a.d).map(x => x.id) : [] })
    return { p, d: p.days[(new Date().getDay() + 6) % 7] }
  }, [days, sum])
  const team = activeTeams(teams, profile.id)[0]
  const hour = new Date().getHours()
  const sl = useLoad(() => profile.consent_health ? api.journal.list('sleep') : [], [])
  const sst = sleepStats(sl.data || []), lastNight = (sl.data || [])[0]

  return <Page title={(hour < 18 ? 'Bonjour ' : 'Bonsoir ') + (profile.display_name || '')}>
    {next ? <a href="#/courses" className="hero glass" style={{ display: 'block', color: 'inherit' }}>
      <Ring value={1 - Math.min(days, 120) / 120} />
      <div className="kick">Prochaine course</div>
      <div className="big num">{days === 0 ? 'Jour J' : days}{days > 0 && <small>{days > 1 ? 'jours' : 'jour'}</small>}</div>
      <div style={{ fontWeight: 600, fontSize: 19 }}>{next.name}</div>
      <div className="muted small">{frDate(next.race_date)}{next.city ? ' · ' + next.city : ''} · {RACE_TYPE(next)}</div>
      {next.goal_seconds && <div className="badge accent" style={{ marginTop: 10 }}>Objectif {fmt(next.goal_seconds)}</div>}
    </a> : <div className="hero glass"><div className="kick">Aucune course prévue</div><p className="muted">Ajoutez vos prochains Hyrox pour lancer le compte à rebours.</p><a className="btn small" href="#/courses">Ajouter une course</a></div>}

    <div className="row-gap" style={{ marginBottom: 6 }}>
      <a className="btn" href="#/seance/nouvelle" style={{ flex: 1 }}><Icon name="play" size={18} />S’entraîner</a>
      <a className="btn glass" href="#/moi/programme" style={{ flex: 1 }}><Icon name="cal" size={18} />Programme</a>
    </div>

    {toKeep.length > 0 && <Sec title="À pointer"><List>{toKeep.map(s => <Row key={s.id} icon="timer" color="#30d158" title={'Pointer ' + (athleteNames(s) || s.name)} sub={s.name} href={'#/seance/' + s.id + '/chrono'} />)}</List></Sec>}
    <Sec title={'Aujourd’hui · ' + today.p.phase.label}>
      <List><Row icon="bolt" color="#5e5ce6" title={today.d.title} sub={today.d.detail} value={today.d.zone} href="#/moi/programme" />
        {profile.consent_health && <Row icon="moon" color="#5856d6" title={lastNight && lastNight.day >= new Date(Date.now() - 864e5).toISOString().slice(0, 10) ? 'Sommeil : ' + fmtH(lastNight.data.asleep) : 'Noter ma nuit'} sub={sst ? 'Moyenne 7 nuits ' + fmtH(sst.avg) + (sst.debt > 300 ? ' · dette ' + fmtH(sst.debt) : '') : 'Suivi du sommeil'} href="#/moi/sante?t=sommeil" />}</List>
    </Sec>

    {team && <Sec title="Mon équipe">
      <List><Row icon="team" color="#30d158" title={team.name} sub={partnerOf(team, profile.id) ? 'Avec ' + partnerOf(team, profile.id).profile.display_name : 'En attente du partenaire · code ' + team.invite_code} href={'#/equipe/' + team.id} /></List>
    </Sec>}

    {lastCustom && <Sec title="Dernière séance spécialisée"><List>{(() => { const c = customSummary(lastCustom); return <Row icon="bolt" color="#bf5af2" title={lastCustom.name} sub={`${frDate(lastCustom.session_date)} · ${c.done}/${c.n} étapes · ${[...new Set(c.steps.map(exLabel))].slice(0, 3).join(', ')}`} value={c.achievement != null ? Math.round(c.achievement * 100) + ' %' : ''} href={'#/seance/' + lastCustom.id + '/stats'} /> })()}</List></Sec>}
    <Sec title="Dernière séance">
      {!loaded ? <p className="muted">Chargement…</p> : !last ? <div className="glass card"><Empty icon="timer">Aucune séance pour l’instant.</Empty></div> : <>
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
