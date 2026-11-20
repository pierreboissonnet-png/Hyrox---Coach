// Point d'entrée unique « S'entraîner » : séance du jour, nouvelle séance, activité faite, planifier, pointer.
import React, { useState } from 'react'
import { useApp } from '../App.jsx'
import { List, Row, Sheet } from '../ui.jsx'
import { todayISO } from '../lib/hyrox.js'
import { isPlanned } from '../lib/custom.js'
import { isKeeperOnly } from './common.js'
import { QuickSheet } from './Activity.jsx'
import { ClaimSheet } from './Sessions.jsx'

export const tomorrow = () => { const d = new Date(Date.now() + 864e5); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }

/** Feuille de choix ; tp = séance du plan du jour (useTodayPlan) */
export function TrainSheet({ onClose, tp }) {
  const { sessions, profile, teams } = useApp()
  const [quick, setQuick] = useState(false), [claim, setClaim] = useState(false)
  const plannedToday = sessions.filter(s => isPlanned(s) && s.session_date === todayISO() && !isKeeperOnly(s, profile.id, teams))
  if (quick) return <QuickSheet onClose={onClose} />
  if (claim) return <ClaimSheet onClose={onClose} />
  return <Sheet title="S’entraîner" onClose={onClose}>
    {(plannedToday.length > 0 || (tp && tp.d.key !== 'repos' && !tp.done)) && <><h2 className="sec" style={{ marginTop: 0 }}>Aujourd’hui</h2><List>
      {plannedToday.map(s => <Row key={s.id} icon="play" color="#30d158" title={'Lancer « ' + s.name + ' »'} sub="Séance prévue aujourd’hui" href={'#/seance/' + s.id + '/chrono'} />)}
      {tp && tp.d.key !== 'repos' && !tp.done && !plannedToday.length && <Row icon="cal" color="#5e5ce6" title={tp.d.title} sub="Séance du plan : préparer et lancer" href="#/moi/programme" />}
    </List></>}
    <h2 className="sec">Nouvelle séance</h2>
    <List>
      <Row icon="bolt" color="#bf5af2" title="Séance personnalisée" sub="Renfo, circuits, EMOM, course… à composer" href="#/seance/specifique" />
      <Row icon="cal" color="#bf5af2" title="Depuis la bibliothèque" sub="Séances types, test de niveau, mes modèles" href="#/seance/specifique?lib=1" />
      <Row icon="timer" color="#0a84ff" title="Format Hyrox" sub="Simulation ou entraînement sur les 8 ateliers, relais en duo" href="#/seance/nouvelle" />
    </List>
    <h2 className="sec">Autre</h2>
    <List>
      <Row icon="plus" color="#ff9f0a" title="Ajouter une activité déjà faite" sub="Footing, vélo, match, renfo à la salle…" onClick={() => setQuick(true)} />
      <Row icon="cal" color="#8e8e93" title="Planifier pour un autre jour" sub="Pré-enregistrer une séance" href={'#/seance/specifique?date=' + tomorrow()} />
      <Row icon="timer" color="#30d158" title="Pointer un athlète" sub="Avec le code affiché sur son téléphone" onClick={() => setClaim(true)} />
    </List>
  </Sheet>
}
