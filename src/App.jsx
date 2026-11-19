import React, { useEffect, useState, useCallback, createContext, useContext, Component } from 'react'
import { api, configured, isDemo } from './lib/api.js'
import { Icon, ToastHost } from './ui.jsx'
import { AuthPage, Onboarding, SetupPage, NewPassword } from './pages/Auth.jsx'
import Home from './pages/Home.jsx'
import Races from './pages/Races.jsx'
import { Teams, TeamDetail, PlanEditor } from './pages/Teams.jsx'
import { Sessions, NewSession, Compare } from './pages/Sessions.jsx'
import SessionPage from './pages/Session.jsx'
import { NewCustom } from './pages/Custom.jsx'
import { Me, Program, Nutrition, Supplements, Health, Profile, Settings, Import, HealthSync } from './pages/Me.jsx'
import { BugSheet, BugsPage, AnalysesPage } from './pages/Bugs.jsx'
import { logError, bugCtx, bugShot } from './lib/bugs.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// ---------- réglages d'affichage (propres à l'appareil) ----------
export function loadSettings() { try { return { glass: 0.55, theme: 'auto', ...JSON.parse(localStorage.getItem('hx-settings') || '{}') } } catch { return { glass: 0.55, theme: 'auto' } } }
export function applySettings(s) {
  const r = document.documentElement
  r.style.setProperty('--ga', s.glass)
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  r.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#07080d' : '#e9eef9')
}

function useHash() {
  const [h, set] = useState(location.hash || '#/')
  useEffect(() => { const f = () => { set(location.hash || '#/'); window.scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { logError('Rendu : ' + err.message, { stack: String(err.stack).slice(0, 900) + '\n' + String(info.componentStack).slice(0, 600) }) }
  render() {
    if (!this.state.err) return this.props.children
    return <div className="page"><div className="card glass" style={{ marginTop: 40 }}>
      <h3>Oups, cet écran a planté</h3>
      <p className="muted">{this.state.err.message}</p>
      <div className="row-gap"><button className="btn" onClick={() => this.props.onReport()}>Signaler le bug</button><button className="btn tinted" onClick={() => { this.setState({ err: null }); location.hash = '#/' }}>Accueil</button></div>
    </div></div>
  }
}

const TABS = [['#/', 'home', 'Accueil'], ['#/courses', 'flag', 'Courses'], ['#/equipe', 'team', 'Équipe'], ['#/seances', 'timer', 'Séances'], ['#/moi', 'user', 'Moi']]

export default function App() {
  const hash = useHash()
  const [settings, setSettingsS] = useState(loadSettings)
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState({ teams: [], races: [], sessions: [], loaded: false })
  const [bug, setBug] = useState(null)
  const busyBug = React.useRef(false)
  const openBug = useCallback(async () => {
    if (busyBug.current) return; busyBug.current = true
    const btns = [...document.querySelectorAll('[data-bug]')]; btns.forEach(b => b.classList.add('busy'))
    const ctx = bugCtx(), shot = await bugShot()   // capture prise au moment du clic, avant d'ouvrir la fenêtre
    btns.forEach(b => b.classList.remove('busy')); busyBug.current = false
    setBug({ ctx, shot })
  }, [])
  useEffect(() => { addEventListener('hx-bug', openBug); return () => removeEventListener('hx-bug', openBug) }, [openBug])

  useEffect(() => { applySettings(settings); try { localStorage.setItem('hx-settings', JSON.stringify(settings)) } catch {} }, [settings])
  useEffect(() => { const m = matchMedia('(prefers-color-scheme: dark)'); const f = () => applySettings(settings); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [settings])
  useEffect(() => {
    if (!configured && !isDemo()) return
    api.auth.user().then(setUser)
    return api.auth.onChange(u => setUser(u))
  }, [])
  useEffect(() => { if (user) api.profiles.get(user.id).then(setProfile).catch(e => logError(e.message)); else setProfile(null) }, [user && user.id])

  const reload = useCallback(async (what = ['teams', 'races', 'sessions']) => {
    const out = {}
    await Promise.all(what.map(async k => { out[k] = await api[k].list() }))
    setData(d => ({ ...d, ...out, loaded: true }))
  }, [])
  useEffect(() => { if (user && profile) reload().catch(e => logError(e.message)) }, [user && user.id, !!profile])

  if (!configured && !isDemo()) return <SetupPage />
  if (user === undefined) return <div className="auth"><img className="logo" src="/icon.svg" alt="" /></div>
  if (hash.startsWith('#/nouveau-mot-de-passe') && user) return <ToastHost><NewPassword /></ToastHost>
  if (!user) return <ToastHost><AuthPage /></ToastHost>
  if (!profile) return <div className="auth"><img className="logo" src="/icon.svg" alt="" /><p className="center muted">Chargement…</p></div>
  if (!profile.sex || !profile.birth_year || !profile.weight_kg) return <ToastHost><Onboarding profile={profile} onDone={setProfile} /></ToastHost>

  const ctx = { user, profile, setProfile, ...data, reload, settings, setSettings: p => setSettingsS(s => ({ ...s, ...p })), openBug }
  const parts = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean)
  const [a, b, c] = parts
  let page
  if (!a) page = <Home />
  else if (a === 'courses') page = <Races />
  else if (a === 'equipe' && !b) page = <Teams />
  else if (a === 'equipe' && c === 'plan') page = <PlanEditor id={b} />
  else if (a === 'equipe') page = <TeamDetail id={b} />
  else if (a === 'seances') page = <Sessions />
  else if (a === 'seance' && b === 'nouvelle') page = <NewSession />
  else if (a === 'seance' && b === 'specifique') page = <NewCustom />
  else if (a === 'seance') page = <SessionPage id={b} tab={c} />
  else if (a === 'comparer') page = <Compare />
  else if (a === 'moi' && !b) page = <Me />
  else if (a === 'moi') page = { programme: <Program />, nutrition: <Nutrition />, complements: <Supplements />, sante: <Health />, profil: <Profile />, reglages: <Settings />, sync: <HealthSync />, import: <Import />, bugs: <BugsPage />, analyses: <AnalysesPage /> }[b] || <Me />
  else page = <Home />
  const tab = '#/' + ({ seance: 'seances', comparer: 'seances' }[a] || a || '')

  return <Ctx.Provider value={ctx}><ToastHost>
    <Boundary key={hash} onReport={openBug}>{page}</Boundary>
    <nav className="tabbar glass" aria-label="Navigation">
      {TABS.map(([h, i, l]) => <a key={h} href={h} aria-current={(h === '#/' ? tab === '#/' : tab.startsWith(h)) ? 'page' : undefined}><Icon name={i} />{l}</a>)}
    </nav>
    {bug && <BugSheet {...bug} onClose={() => setBug(null)} />}
  </ToastHost></Ctx.Provider>
}
