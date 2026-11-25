// Signalements de bugs (même principe que l'appli Quiz CI BSPP) :
// capture de l'écran au moment du clic, contexte technique, erreurs JavaScript et dernières actions.
export const APP_VERSION = '1.15.0'
const errs = [], trail = []
const push = (arr, max, item) => { arr.push(item); if (arr.length > max) arr.shift() }
const hhmmss = () => new Date().toLocaleTimeString('fr-FR')

export function installCapture() {
  if (window.__hxCapture) return
  window.__hxCapture = true
  addEventListener('error', e => push(errs, 20, { t: hhmmss(), type: 'erreur', msg: String(e.message).slice(0, 300), src: (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno, stack: e.error && String(e.error.stack).slice(0, 700) }))
  addEventListener('unhandledrejection', e => push(errs, 20, { t: hhmmss(), type: 'promesse', msg: String((e.reason && (e.reason.message || e.reason)) || 'rejet').slice(0, 300), stack: e.reason && e.reason.stack && String(e.reason.stack).slice(0, 700) }))
  const ce = console.error.bind(console)
  console.error = (...a) => { push(errs, 20, { t: hhmmss(), type: 'console', msg: a.map(x => x instanceof Error ? x.message : typeof x === 'string' ? x : JSON.stringify(x)).join(' ').slice(0, 300) }); ce(...a) }
  // Journal des dernières actions (écrans visités, boutons touchés) pour reproduire le bug
  addEventListener('hashchange', () => track('écran', location.hash || '#/'))
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button, a, [role=button], input[type=checkbox], select')
    if (!b || b.closest('[data-bugsheet]')) return
    const label = (b.getAttribute('aria-label') || b.textContent || b.name || b.tagName).replace(/\s+/g, ' ').trim().slice(0, 50)
    if (label) track('clic', label)
  }, true)
}
export const track = (k, v) => push(trail, 30, { t: hhmmss(), k, v: String(v).slice(0, 80) })
export const logError = (msg, extra = {}) => push(errs, 20, { t: hhmmss(), type: 'app', msg: String(msg).slice(0, 300), ...extra })

const SCREENS = { '': 'Accueil', courses: 'Courses', equipe: 'Équipe', seances: 'Séances', seance: 'Séance', comparer: 'Comparer', moi: 'Moi' }
export function screenName() {
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')
  return [SCREENS[a || ''] || a, a === 'seance' && b === 'nouvelle' ? 'nouvelle' : a === 'moi' ? b : a === 'seance' ? (c || 'chrono') : a === 'equipe' && c ? c : ''].filter(Boolean).join(' › ')
}
/** Contexte joint au signalement (aucune donnée de santé) */
export function bugCtx(extra = {}) {
  return {
    version: APP_VERSION, ecran: screenName(), route: location.hash || '#/',
    ecranTaille: `${innerWidth}×${innerHeight} px (×${Math.round((devicePixelRatio || 1) * 100) / 100})`,
    installee: (matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? 'oui' : 'non',
    reseau: navigator.onLine === false ? 'hors ligne' : 'en ligne', theme: document.documentElement.dataset.theme || '',
    appareil: navigator.userAgent.slice(0, 220), heureLocale: new Date().toLocaleString('fr-FR'),
    erreurs: errs.slice(-10), actions: trail.slice(-15), ...extra,
  }
}
/** Capture de l'écran visible (html2canvas, chargé à la demande) ; null si impossible */
export async function bugShot() {
  const run = async () => {
    const { default: h2c } = await import('html2canvas')
    const bg = getComputedStyle(document.body).backgroundColor
    const cv = await h2c(document.body, { backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff', x: scrollX, y: scrollY, width: innerWidth, height: innerHeight, windowWidth: document.documentElement.clientWidth, windowHeight: innerHeight, scale: Math.min(2, devicePixelRatio || 1), useCORS: true, logging: false, imageTimeout: 2500, ignoreElements: el => !!(el.matches && el.matches('.toast')) /* les fenêtres ouvertes font partie du contexte */, onclone: doc => { const st = doc.createElement('style'); st.textContent = '*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important} .glass{background:var(--glass-strong)!important}'; doc.head.appendChild(st) } })
    const w = Math.min(720, cv.width), h = Math.round(cv.height * w / cv.width), c2 = document.createElement('canvas')
    c2.width = w; c2.height = h; c2.getContext('2d').drawImage(cv, 0, 0, w, h)
    let url = c2.toDataURL('image/jpeg', 0.72); if (url.length > 850000) url = c2.toDataURL('image/jpeg', 0.45)
    return url.length > 890000 ? null : url
  }
  try { return await Promise.race([run(), new Promise(r => setTimeout(() => r(null), 9000))]) } catch (e) { console.warn('Capture impossible :', e && e.message); return null }
}
export const BUG_ST = { new: ['Nouveau', 'bad'], doing: ['En cours', 'warn'], done: ['Résolu', 'good'], wontfix: ['Sans suite', ''] }
export const bugDate = t => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export function download(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000) }
export function dataUrlBlob(u) { const [h, d] = u.split(','); const mime = (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg'; const bin = atob(d), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }) }
export function exportCsv(L) {
  const C = [['no', 'N°'], ['date', 'Date'], ['statut', 'Statut'], ['pseudo', 'Membre'], ['ecran', 'Écran'], ['texte', 'Description'], ['capture', 'Capture'], ['version', 'Version'], ['installee', 'Appli installée'], ['reseau', 'Réseau'], ['ecranTaille', "Taille d'écran"], ['appareil', 'Appareil'], ['erreurs', 'Erreurs JS'], ['note', 'Note de suivi'], ['analyse', 'Diagnostic Claude'], ['par', 'Traité par']]
  const row = b => { const c = b.ctx || {}; return { no: b.no, date: new Date(b.created_at).toISOString().replace('T', ' ').slice(0, 19), statut: (BUG_ST[b.status] || BUG_ST.new)[0], pseudo: b.pseudo, ecran: c.ecran, texte: b.text, capture: b.has_img ? 'oui' : 'non', version: c.version, installee: c.installee, reseau: c.reseau, ecranTaille: c.ecranTaille, appareil: c.appareil, erreurs: (c.erreurs || []).map(e => e.msg).join(' | '), note: b.note, analyse: b.analysis, par: b.updated_by } }
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  download(new Blob(['﻿' + [C.map(x => q(x[1])).join(';'), ...L.map(b => { const r = row(b); return C.map(x => q(r[x[0]])).join(';') })].join('\r\n')], { type: 'text/csv;charset=utf-8' }), `signalements_${new Date().toISOString().slice(0, 10)}.csv`)
}
