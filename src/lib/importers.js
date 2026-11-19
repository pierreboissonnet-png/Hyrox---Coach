// Import des données existantes : sauvegarde de l'artefact « Chrono Hyrox Duo » et export de l'app iPhone.
// Les anciens athlètes P / L deviennent les places A / B de l'équipe.
import { normData } from './session.js'

export function detect(json) {
  if (json && json.export === 'Chrono Hyrox Duo' && json.collections) return 'chrono'
  if (json && json.format === 'hyrox-duo-app-1') return 'ios'
  return null
}
/** Athlètes présents dans le fichier (pour demander « qui êtes-vous ? ») */
export function athletesIn(json) {
  const set = new Set()
  const scan = d => Object.values((d && d.relays) || {}).forEach(rs => rs.forEach(r => r.w && set.add(r.w)))
  if (detect(json) === 'chrono') { Object.values(json.collections.sessions || {}).forEach(scan); Object.keys((json.collections.config || {}).athletes || {}).forEach(k => set.add(k)) }
  else if (detect(json) === 'ios') { scan(json.session); Object.keys(json.hr || {}).forEach(k => set.add(k)) }
  return [...set].sort()
}
const mapW = (w, map) => map[w] || w
function mapData(d, map) {
  d = normData(d)
  const relays = {}
  Object.entries(d.relays).forEach(([k, rs]) => { relays[k] = rs.map(r => ({ ...r, w: mapW(r.w, map) })) })
  const runs = {}
  Object.entries(d.runs || {}).forEach(([k, v]) => { const o = {}; Object.entries(v || {}).forEach(([kk, vv]) => { o[kk === 'km' ? 'km' : mapW(kk, map)] = vv }); runs[k] = o })
  return { startedAt: d.startedAt, cp: d.cp, relays, runs, units: d.units || {}, runKm: d.runKm || 1, note: d.note || '' }
}

/**
 * @param map ex. {P:'A', L:'B'}
 * @returns {sessions:[{name, session_date, kind, data, hr:{A?,B?}}], strat, zones:{A?,B?}}
 */
export function convert(json, map, { includeExamples = false } = {}) {
  const kind = detect(json)
  if (kind === 'chrono') {
    const c = json.collections, out = []
    Object.entries(c.sessions || {}).forEach(([id, s]) => {
      if (s.example && !includeExamples) return
      const hr = {}
      Object.values(c.hr || {}).filter(h => h.sessionId === id).forEach(h => { hr[mapW(h.w, map)] = { t: h.t, bpm: h.bpm, source: h.source || h.fileName || '', offset_s: h.offset || 0 } })
      out.push({ name: s.name || 'Séance importée', session_date: s.date, kind: s.official ? 'course' : 'entrainement', data: mapData(s, map), hr })
    })
    let strat = null
    const st = c.config && c.config.strategie && c.config.strategie.stations
    if (st) { strat = {}; Object.entries(st).forEach(([k, v]) => { strat[k] = { ...v, t: (v.t || []).map(x => ({ ...x, w: mapW(x.w, map) })) } }) }
    const zones = {}
    Object.entries((c.config && c.config.athletes) || {}).forEach(([k, v]) => { zones[mapW(k, map)] = { hr_max: v.fcmax || null, hr_zones: v.zones || null } })
    return { sessions: out.sort((a, b) => a.session_date.localeCompare(b.session_date)), strat, zones }
  }
  if (kind === 'ios') {
    const s = json.session, hr = {}
    Object.entries(json.hr || {}).forEach(([k, v]) => { hr[mapW(k, map)] = { t: v.t, bpm: v.bpm, source: v.source || 'App iPhone', offset_s: v.offset || 0 } })
    return { sessions: [{ name: s.name || 'Séance iPhone', session_date: s.date, kind: 'entrainement', data: mapData(s, map), hr }], strat: null, zones: {} }
  }
  throw new Error('Fichier non reconnu : sauvegarde « Chrono Hyrox Duo » ou export de l’app iPhone attendu.')
}
