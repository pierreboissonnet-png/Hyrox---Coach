import React, { useState } from 'react'
import { api, setDemo, COACH_MODE } from '../lib/api.js'
import { List, Field, Seg, Switch, useToast } from '../ui.jsx'

export function SetupPage() {
  return <div className="auth">
    <img className="logo" src="/icon.svg" alt="" />
    <h1>Hyrox Coach</h1>
    <p className="lead">La base de données n’est pas encore reliée.</p>
    <div className="card glass">
      <p>Ajoutez les variables <b>VITE_SUPABASE_URL</b> et <b>VITE_SUPABASE_ANON_KEY</b> dans Netlify (Site configuration › Environment variables), puis redéployez. Le tutoriel fourni détaille chaque étape.</p>
      <button className="btn block" onClick={() => setDemo(true)}>Essayer en mode démo</button>
      <p className="small muted center" style={{ marginTop: 10 }}>Données fictives, gardées dans ce navigateur uniquement.</p>
    </div>
  </div>
}

export function AuthPage() {
  const [mode, setMode] = useState('in')
  const [f, setF] = useState({ email: '', password: '', name: '' })
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [info, setInfo] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.value })
  async function go(e) {
    e.preventDefault(); setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'in') await api.auth.signIn(f.email.trim(), f.password)
      else if (mode === 'up') {
        if (f.password.length < 8) throw new Error('Mot de passe : 8 caractères minimum')
        const r = await api.auth.signUp(f.email.trim(), f.password, f.name.trim())
        if (!r.session && !api.demo) setInfo('Compte créé : confirmez votre adresse via l’e-mail reçu, puis connectez-vous.')
      } else { await api.auth.reset(f.email.trim()); setInfo('Si un compte existe, un e-mail de réinitialisation a été envoyé.') }
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return <div className="auth">
    <img className="logo" src="/icon.svg" alt="" />
    <h1>Hyrox Coach</h1>
    <p className="lead">Préparez vos Hyrox, en solo ou en duo.</p>
    <Seg value={mode} onChange={setMode} options={[['in', 'Connexion'], ['up', 'Créer un compte'], ['reset', 'Oubli']]} />
    <form onSubmit={go}>
      <List>
        {mode === 'up' && <Field label="Prénom"><input value={f.name} onChange={set('name')} autoComplete="given-name" required placeholder="Pierre" /></Field>}
        <Field label="E-mail"><input type="email" value={f.email} onChange={set('email')} autoComplete="email" required placeholder="vous@exemple.fr" /></Field>
        {mode !== 'reset' && <Field label="Mot de passe"><input type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required placeholder="••••••••" /></Field>}
      </List>
      {err && <p className="err">{err}</p>}
      {info && <p className="note">{info}</p>}
      <button className="btn block" style={{ marginTop: 16 }} disabled={busy}>{busy ? '…' : mode === 'in' ? 'Se connecter' : mode === 'up' ? 'Créer mon compte' : 'Recevoir le lien'}</button>
    </form>
    {api.demo && <>
      <button className="btn green block" style={{ marginTop: 12 }} onClick={() => api.auth.signIn()}>Entrer dans la démo</button>
      <p className="center small" style={{ marginTop: 18 }}><button className="link" onClick={() => setDemo(false)}>Quitter le mode démo</button></p></>}
  </div>
}

export function NewPassword() {
  const [pw, setPw] = useState(''), toast = useToast()
  return <div className="auth"><h1>Nouveau mot de passe</h1>
    <List><Field label="Mot de passe"><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></Field></List>
    <button className="btn block" style={{ marginTop: 16 }} disabled={pw.length < 8} onClick={async () => { await api.auth.setPassword(pw); toast('Mot de passe modifié'); location.hash = '#/' }}>Enregistrer</button>
  </div>
}

export function Onboarding({ profile, onDone }) {
  const y = new Date().getFullYear()
  const [f, setF] = useState({ display_name: profile.display_name || '', sex: profile.sex || '', birth_year: profile.birth_year || '', weight_kg: profile.weight_kg || '', height_cm: profile.height_cm || '', consent_health: profile.consent_health, consent_ai: profile.consent_ai })
  const [err, setErr] = useState('')
  const ok = f.sex && f.birth_year >= 1920 && f.birth_year <= y - 12 && f.weight_kg > 30
  async function save() {
    try { onDone(await api.profiles.update(profile.id, { ...f, birth_year: +f.birth_year, weight_kg: +f.weight_kg, height_cm: f.height_cm ? +f.height_cm : null })) } catch (e) { setErr(e.message) }
  }
  return <div className="auth" style={{ maxWidth: 520 }}>
    <h1>Votre profil</h1>
    <p className="lead">Ces informations servent à estimer vos temps, vos zones cardio et vos besoins.</p>
    <List>
      <Field label="Prénom"><input value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} /></Field>
      <div className="row"><span className="label"><span className="t">Sexe</span></span>
        <div className="seg" style={{ margin: 0, width: 210 }}>{[['F', 'Femme'], ['M', 'Homme'], ['X', 'Autre']].map(([v, l]) => <button key={v} aria-pressed={f.sex === v} onClick={() => setF({ ...f, sex: v })}>{l}</button>)}</div></div>
      <Field label="Année de naissance"><input type="number" inputMode="numeric" value={f.birth_year} onChange={e => setF({ ...f, birth_year: e.target.value })} placeholder="1986" /></Field>
      <Field label="Poids (kg)"><input type="number" inputMode="decimal" step="0.1" value={f.weight_kg} onChange={e => setF({ ...f, weight_kg: e.target.value })} placeholder="75" /></Field>
      <Field label="Taille (cm)" sub="Facultatif"><input type="number" inputMode="numeric" value={f.height_cm} onChange={e => setF({ ...f, height_cm: e.target.value })} placeholder="178" /></Field>
    </List>
    <h2 className="sec">Vos accords</h2>
    <List>
      <div className="row"><span className="label"><span className="t">Données de santé</span><span className="s">{'J’accepte que mon poids, mon sommeil, mes prises de sang' + (f.sex === 'F' ? ', mon cycle menstruel' : '') + ' et mon bien-être soient enregistrés.'} Ils restent privés : même mon partenaire ne les voit pas.</span></span><Switch checked={f.consent_health} onChange={v => setF({ ...f, consent_health: v })} label="Données de santé" /></div>
      {COACH_MODE === 'claude' && <div className="row"><span className="label"><span className="t">Coach IA</span><span className="s">J’accepte que les temps de mes séances (et ma fréquence cardiaque) soient envoyés à Claude, l’IA d’Anthropic, pour recevoir des conseils après chaque séance.</span></span><Switch checked={f.consent_ai} onChange={v => setF({ ...f, consent_ai: v })} label="Coach IA" /></div>}
    </List>
    <p className="foot">Modifiable à tout moment dans Moi › Réglages.</p>
    {err && <p className="err">{err}</p>}
    <button className="btn block" style={{ marginTop: 16 }} disabled={!ok} onClick={save}>Continuer</button>
  </div>
}
