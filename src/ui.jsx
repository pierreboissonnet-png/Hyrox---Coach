// Composants d'interface et icônes (dessinées pour l'app, aucune ressource Apple).
import React, { useEffect, useState, createContext, useContext } from 'react'

const P = {
  home: <><path d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 4.5c3-1.6 5.5 1.6 8.5 0s4 0 4 0v9s-1-1.6-4 0-5.5-1.6-8.5 0" /></>,
  team: <><circle cx="9" cy="8.5" r="3" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M14.5 14.3c.6-.2 1.3-.3 2-.3 2.2 0 3.8 1.5 4.2 4.2" /></>,
  timer: <><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V10M10 3.5h4M18.5 7l1.3-1.3" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></>,
  chev: <path d="m9.5 6 6 6-6 6" />,
  back: <path d="m14.5 6-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  bug: <><rect x="7.5" y="8" width="9" height="11" rx="4.5" /><path d="M12 8v11M9.5 8a2.5 2.5 0 0 1 5 0M4.5 12h3M16.5 12h3M5 17.5l2.6-1.3M19 17.5l-2.6-1.3M5.5 7.5l2.4 1.6M18.5 7.5l-2.4 1.6" /></>,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z" />,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>,
  leaf: <><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" /><path d="M5 19 13 11" /></>,
  pill: <><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="m9.5 8.4 5 7.2" /></>,
  drop: <path d="M12 4s6 6.6 6 10.5a6 6 0 0 1-12 0C6 10.6 12 4 12 4z" />,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 10a5 5 0 0 1 7 0l-2.2 2.2" /></>,
  cal: <><rect x="4" y="5.5" width="16" height="14.5" rx="3" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
  bolt: <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z" />,
  spark: <><path d="M12 4v4M12 16v4M4 12h4M16 12h4" /><path d="m7 7 2 2M15 15l2 2M17 7l-2 2M9 15l-2 2" /></>,
  upload: <><path d="M12 15V4.5M7.5 9 12 4.5 16.5 9" /><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  copy: <><rect x="8" y="8" width="11" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-6A2.5 2.5 0 0 0 5 6.5v8A2.5 2.5 0 0 0 7.5 17H8" /></>,
  trash: <><path d="M5 7h14M10 7V5h4v2M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.6h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" /></>,
  undo: <><path d="M8.5 8.5H15a4.5 4.5 0 0 1 0 9h-4" /><path d="M11 5 7.5 8.5 11 12" /></>,
  swap: <><path d="M6 8.5h12l-3-3M18 15.5H6l3 3" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />,
  compare: <><path d="M9 4v16M15 4v16" /><path d="M4.5 9 9 4.5M19.5 15 15 19.5" /></>,
}
export function Icon({ name, size = 22, stroke = 1.8, style, className }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">{P[name]}</svg>
}

// ---------- navigation : « Retour » ramène à l'écran d'où l'on vient (sinon à l'écran parent) ----------
const NAV_KEY = 'hx-nav'
const navStack = () => { try { return JSON.parse(sessionStorage.getItem(NAV_KEY) || '[]') } catch { return [] } }
const setStack = st => { try { sessionStorage.setItem(NAV_KEY, JSON.stringify(st.slice(-40))) } catch {} }
/** À appeler à chaque changement d'écran */
export function trackNav(hash) {
  const st = navStack()
  if (window.__hxReplace) { window.__hxReplace = false; st[st.length ? st.length - 1 : 0] = hash }
  else if (st.length >= 2 && st[st.length - 2] === hash) st.pop()
  else if (st[st.length - 1] !== hash) st.push(hash)
  setStack(st)
}
/** Changer d'écran ; replace = sans créer d'étape dans l'historique (onglets, après une création…) */
export function go(hash, replace) { if (replace) { window.__hxReplace = true; location.replace(hash) } else location.hash = hash }
function goBack(e, fallback) { const st = navStack(); if (st.length >= 2) { e.preventDefault(); history.back() } else if (!fallback) e.preventDefault() }
export function Nav({ back, title, actions }) {
  return <div className="nav">
    {back && <a className="back glass" href={back} onClick={e => goBack(e, back)}><Icon name="back" size={20} stroke={2.2} />Retour</a>}
    <div className="actions">{actions}<button className="icon-btn glass bugbtn" data-bug onClick={() => dispatchEvent(new Event('hx-bug'))} aria-label="Signaler un problème" title="Signaler un problème"><Icon name="bug" size={20} /></button></div>
  </div>
}
export function Page({ title, subtitle, back, actions, children }) {
  return <div className="page">
    <Nav back={back} actions={actions} />
    {title && <h1 className="large-title">{title}</h1>}
    {subtitle && <p className="subtitle">{subtitle}</p>}
    {children}
  </div>
}
export const Sec = ({ title, children, foot }) => <>
  {title && <h2 className="sec">{title}</h2>}
  {children}
  {foot && <p className="foot">{foot}</p>}
</>
export const List = ({ children, className = '' }) => <div className={'list glass ' + className}>{children}</div>
export function Row({ icon, color, title, sub, value, href, onClick, chev, children, className = '' }) {
  const inner = <>
    {icon && <span className="ico" style={{ background: color || 'var(--accent)' }}><Icon name={icon} size={18} stroke={2} /></span>}
    <span className="label"><span className="t">{title}</span>{sub && <span className="s">{sub}</span>}</span>
    {value != null && <span className="val num">{value}</span>}
    {children}
    {(chev ?? !!(href || onClick)) && <Icon name="chev" size={16} stroke={2.4} className="chev" />}
  </>
  const cls = 'row ' + (icon ? 'inset ' : '') + className
  if (href) return <a className={cls} href={href}>{inner}</a>
  if (onClick) return <button className={cls} onClick={onClick}>{inner}</button>
  return <div className={cls}>{inner}</div>
}
export function Field({ label, sub, children }) {
  return <label className="row"><span className="label"><span className="t">{label}</span>{sub && <span className="s">{sub}</span>}</span>{children}</label>
}
export function Switch({ checked, onChange, label }) {
  return <span className="switch"><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} aria-label={label} /><i /></span>
}
export function Seg({ value, options, onChange }) {
  return <div className="seg" role="group">{options.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>
}
/** Filtres en pastilles qui passent à la ligne (rien ne déborde de l'écran) */
export function Chips({ value, options, onChange, label }) {
  return <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0 10px' }}>
    {options.map(([v, l]) => { const on = value === v; return <button key={v} aria-pressed={on} onClick={() => onChange(v)}
      style={{ border: 0, borderRadius: 999, padding: '7px 13px', fontSize: 14, fontWeight: on ? 650 : 500, background: on ? 'var(--accent)' : 'var(--fill)', color: on ? '#fff' : 'var(--ink)', cursor: 'pointer' }}>{l}</button> })}
  </div>
}
export function Sheet({ title, onClose, children, actions, footer, noBug }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])
  return <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="sheet glass" role="dialog" aria-modal="true" aria-label={title}>
      <div className="grab" />
      <div className="sheet-head"><button className="btn plain" onClick={onClose}>Fermer</button><h3>{title}</h3>
        <span className="row-gap" style={{ gap: 4, flexWrap: 'nowrap' }}>{actions || null}{!noBug && <button className="icon-btn bugbtn" data-bug onClick={() => dispatchEvent(new Event('hx-bug'))} aria-label="Signaler un problème" title="Signaler un problème" style={{ width: 34, height: 34 }}><Icon name="bug" size={18} /></button>}{!actions && noBug && <span style={{ width: 60, display: 'inline-block' }} />}</span></div>
      {children}
      {footer && <div className="sheet-foot">{footer}</div>}
    </div>
  </div>
}
/**
 * Saisie des temps au pavé numérique (sans « : » sur iPhone) : on tape les chiffres, les « : » se placent seuls.
 * 130 → 1:30 · 10500 → 1:05:00. Le « : » tapé à la main est aussi accepté.
 */
export function maskT(v) {
  const d = String(v || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 6)
  return d.length <= 2 ? d : d.length <= 4 ? d.slice(0, -2) + ':' + d.slice(-2) : d.slice(0, -4) + ':' + d.slice(-4, -2) + ':' + d.slice(-2)
}
/** À étaler sur un <input> non contrôlé : {...TIME} */
export const TIME = { inputMode: 'numeric', autoComplete: 'off', placeholder: 'm:ss', onInput: e => { e.target.value = maskT(e.target.value) } }
/** Nombre saisi au clavier (virgule ou point) ; null si vide ou invalide */
export const parseNum = v => { if (v == null || String(v).trim() === '') return null; const n = +String(v).trim().replace(/\s/g, '').replace(',', '.'); return Number.isFinite(n) ? n : null }
export const Empty = ({ icon = 'spark', children }) => <div className="empty"><Icon name={icon} />{children}</div>
export function Stat({ k, v, d, tone }) {
  return <div className="stat glass"><div className="k">{k}</div><div className="v num">{v}</div>{d != null && <div className={'d num ' + (tone || '')}>{d}</div>}</div>
}

// ---------- notifications ----------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastHost({ children }) {
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t) }, [msg])
  return <ToastCtx.Provider value={setMsg}>{children}{msg && <div className="toast glass" role="status">{msg}</div>}</ToastCtx.Provider>
}

/** Petit hook de chargement asynchrone */
export function useLoad(fn, deps) {
  const [st, set] = useState({ data: null, error: null, loading: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    set(s => ({ ...s, loading: true }))
    Promise.resolve().then(fn).then(data => live && set({ data, error: null, loading: false }), error => live && set({ data: null, error, loading: false }))
    return () => { live = false }
  }, [...deps, n])
  return { ...st, reload: () => setN(x => x + 1), set: data => set(s => ({ ...s, data })) }
}
