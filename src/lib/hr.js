// Fréquence cardiaque : lecture des fichiers (export Santé, FIT, TCX, GPX, CSV), interpolation, zones.
import { Unzip, UnzipInflate } from 'fflate'

export function normDate(str) {
  str = String(str).trim()
  let m = str.match(/^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d(?:\.\d+)?)\s*([+-]\d\d):?(\d\d)$/)
  if (m) return Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`)
  m = str.match(/^(\d\d)\/(\d\d)\/(\d{4})[ T](\d\d?):(\d\d)(?::(\d\d))?/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime()
  m = str.match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d(?::\d\d)?)$/)
  if (m) return Date.parse(`${m[1]}T${m[2]}`)
  const t = Date.parse(str)
  return isNaN(t) ? null : t
}

export function lineScanner(onLine) {
  let rest = ''
  return (text, final) => {
    const parts = (rest + text).split('\n')
    rest = final ? '' : parts.pop()
    for (const p of parts) onLine(p)
    if (final && rest) onLine(rest)
  }
}
function appleLine(out) {
  const reType = /type="HKQuantityTypeIdentifierHeartRate"/, reStart = /startDate="([^"]+)"/, reVal = /value="([\d.]+)"/
  return line => {
    if (line.indexOf('HKQuantityTypeIdentifierHeartRate"') < 0 || !reType.test(line)) return
    const s = line.match(reStart), v = line.match(reVal)
    if (!s || !v) return
    const t = normDate(s[1]); if (t != null) out.push([t, +v[1]])
  }
}
export async function streamText(file, onText, onProg) {
  const reader = file.stream().getReader(), dec = new TextDecoder(); let read = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (value) { read += value.length; onText(dec.decode(value, { stream: true }), false); onProg && onProg(read / file.size) }
    if (done) { onText(dec.decode(), true); break }
  }
}
export function streamZip(file, onText, onProg) {
  return new Promise(async (resolve, reject) => {
    const uz = new Unzip(); uz.register(UnzipInflate)
    let found = false
    uz.onfile = f => {
      if (!/(^|\/)(export|exportation)\.xml$/i.test(f.name)) return
      found = true
      const dec = new TextDecoder()
      f.ondata = (err, chunk, final) => { if (err) return reject(err); onText(dec.decode(chunk, { stream: !final }), final); if (final) resolve() }
      f.start()
    }
    try {
      const reader = file.stream().getReader(); let read = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (value) { read += value.length; uz.push(value, false); onProg && onProg(read / file.size); await new Promise(r => setTimeout(r, 0)) }
        if (done) { uz.push(new Uint8Array(0), true); break }
      }
      if (!found) reject(new Error('Aucun fichier export.xml trouvé dans le zip.'))
    } catch (e) { reject(e) }
  })
}
export function parseTCX(text) {
  const out = []
  for (const m of text.matchAll(/<Trackpoint>([\s\S]*?)<\/Trackpoint>/g)) {
    const t = m[1].match(/<Time>([^<]+)<\/Time>/), h = m[1].match(/<HeartRateBpm[^>]*>\s*<Value>(\d+)<\/Value>/)
    if (t && h) out.push([Date.parse(t[1]), +h[1]])
  }
  return out
}
export function parseGPX(text) {
  const out = []
  for (const m of text.matchAll(/<trkpt[\s\S]*?<\/trkpt>/g)) {
    const t = m[0].match(/<time>([^<]+)<\/time>/), h = m[0].match(/<(?:\w+:)?(?:hr|heartrate)>(\d+)</i)
    if (t && h) out.push([Date.parse(t[1]), +h[1]])
  }
  return out
}
export function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : (lines[0].includes('\t') ? '\t' : ',')
  const sp = l => l.split(delim).map(x => x.trim().replace(/^"|"$/g, ''))
  const head = sp(lines[0]).map(h => h.toLowerCase())
  const tsIdx = head.findIndex(h => h === 'timestamp')          // secondes epoch (HealthFit…)
  const isoIdx = head.findIndex(h => /iso8601/.test(h))
  let ti = isoIdx >= 0 ? isoIdx : head.findIndex(h => /date|time|heure/.test(h) && !/zone|since/.test(h))
  let hi = head.findIndex(h => /(heart|fc|bpm|fr[ée]quence|pouls)/.test(h) && /avg|moy/.test(h))
  if (hi < 0) hi = head.findIndex(h => /(heart|fc|bpm|fr[ée]quence|pouls)/.test(h) && !/min|max|variab|hrv/.test(h))
  if ((ti < 0 && tsIdx < 0) || hi < 0) throw new Error('Colonnes date/heure et fréquence cardiaque introuvables dans le CSV.')
  const out = []
  for (let k = 1; k < lines.length; k++) {
    const c = sp(lines[k])
    let t = null
    if (isoIdx >= 0) t = Date.parse(c[isoIdx])
    if ((t == null || isNaN(t)) && tsIdx >= 0) { const v = parseFloat(String(c[tsIdx]).replace(',', '.')); if (isFinite(v)) t = v > 1e11 ? v : v * 1000 }
    if ((t == null || isNaN(t)) && ti >= 0) t = normDate(c[ti])
    const v = parseFloat(String(c[hi]).replace(',', '.'))
    if (t != null && !isNaN(t) && isFinite(v) && v > 25 && v < 250) out.push([t, v])
  }
  return out
}
export function parseFIT(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), hs = u8[0]
  if (String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) !== '.FIT') throw new Error('Fichier FIT invalide.')
  const end = Math.min(buf.byteLength, hs + dv.getUint32(4, true)), EPOCH = 631065600
  const defs = {}; let p = hs, lastTs = 0; const out = []
  while (p < end) {
    const h = u8[p++]
    if (h & 0x80) {
      const d = defs[(h >> 5) & 3], off = h & 0x1f; if (!d) throw new Error('FIT corrompu.')
      let ts = (lastTs & ~0x1f) + off; if (off < (lastTs & 0x1f)) ts += 0x20; lastTs = ts
      let hr = null, q = p
      for (const f of d.fields) { if (d.global === 20 && f.num === 3 && f.size === 1) hr = u8[q]; q += f.size }
      p = q + d.devSize
      if (d.global === 20 && hr != null && hr !== 255) out.push([(ts + EPOCH) * 1000, hr])
    } else if (h & 0x40) {
      const lt = h & 0x0f, dev = h & 0x20, le = u8[p + 1] === 0, global = dv.getUint16(p + 2, le), nf = u8[p + 4]
      p += 5; const fields = []
      for (let k = 0; k < nf; k++) { fields.push({ num: u8[p], size: u8[p + 1] }); p += 3 }
      let devSize = 0
      if (dev) { const nd = u8[p++]; for (let k = 0; k < nd; k++) { devSize += u8[p + 1]; p += 3 } }
      defs[lt] = { le, global, fields, devSize }
    } else {
      const d = defs[h & 0x0f]; if (!d) throw new Error('FIT corrompu.')
      let ts = null, hr = null, q = p
      for (const f of d.fields) {
        if (f.num === 253 && f.size === 4) ts = dv.getUint32(q, d.le)
        if (d.global === 20 && f.num === 3 && f.size === 1) hr = u8[q]
        q += f.size
      }
      p = q + d.devSize
      if (ts != null) lastTs = ts
      if (d.global === 20 && ts != null && hr != null && hr !== 255) out.push([(ts + EPOCH) * 1000, hr])
    }
  }
  return out
}

/** Lit un fichier et renvoie {t:[s depuis départ], bpm:[]} pour la fenêtre de la séance. */
export async function readHRFile(file, startedAt, durationMs, onProg) {
  const name = file.name.toLowerCase()
  let pts = []
  if (name.endsWith('.zip')) await streamZip(file, lineScanner(appleLine(pts)), onProg)
  else if (name.endsWith('.xml')) await streamText(file, lineScanner(appleLine(pts)), onProg)
  else if (name.endsWith('.fit')) pts = parseFIT(await file.arrayBuffer())
  else if (name.endsWith('.tcx')) pts = parseTCX(await file.text())
  else if (name.endsWith('.gpx')) pts = parseGPX(await file.text())
  else if (name.endsWith('.csv') || name.endsWith('.txt')) pts = parseCSV(await file.text())
  else throw new Error('Format non reconnu (.zip, .xml, .fit, .tcx, .gpx, .csv).')
  if (!pts.length) throw new Error('Aucune mesure de fréquence cardiaque dans ce fichier.')
  return toSeries(pts, startedAt, durationMs)
}
export function toSeries(pts, startedAt, durationMs) {
  const from = startedAt - 600000, to = startedAt + (durationMs || 3 * 3600e3) + 600000
  const inW = pts.filter(([t]) => t >= from && t <= to)
  if (!inW.length) {
    const min = Math.min(...pts.map(p => p[0])), max = Math.max(...pts.map(p => p[0]))
    throw new Error(`Le fichier contient des mesures du ${new Date(min).toLocaleString('fr-FR')} au ${new Date(max).toLocaleString('fr-FR')}, mais aucune pendant la séance (départ le ${new Date(startedAt).toLocaleString('fr-FR')}).`)
  }
  const map = new Map()
  inW.sort((a, b) => a[0] - b[0]).forEach(([t, b]) => map.set(Math.round((t - startedAt) / 1000), Math.round(b)))
  let ks = [...map.keys()].sort((a, b) => a - b)
  if (ks.length > 9000) { const step = Math.ceil(ks.length / 9000); ks = ks.filter((_, i) => i % step === 0) }
  return { t: ks, bpm: ks.map(k => map.get(k)) }
}

// ---------- calcul ----------
const GAP = 30
export function series(row) {
  if (!row || !row.t || !row.t.length) return null
  const off = +row.offset_s || 0
  const t = row.t.map(x => x + off)
  const gaps = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b)
  const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 5
  return { t, b: row.bpm, gap: Math.max(GAP, med * 2.5) }
}
export function hrAt(S, t) {
  if (!S) return null
  const T = S.t, n = T.length
  if (t < T[0] || t > T[n - 1]) return null
  let lo = 0, hi = n - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m }
  if (T[hi] === T[lo]) return S.b[lo]
  if (T[hi] - T[lo] > S.gap) return null
  return S.b[lo] + (S.b[hi] - S.b[lo]) * (t - T[lo]) / (T[hi] - T[lo])
}
export function hrStat(S, a, b) {
  if (!S || a == null || b == null || b <= a) return null
  let sum = 0, n = 0, mx = -1, mn = 999
  for (let t = a; t <= b; t += 1) { const v = hrAt(S, t); if (v != null) { sum += v; n++; if (v > mx) mx = v; if (v < mn) mn = v } }
  return n ? { avg: sum / n, max: Math.round(mx), min: Math.round(mn), n } : null
}

// Zones : FC de début des zones 2..5 (zones[0] ignoré). Par défaut : % de FC max.
export function zonesOf(profile) {
  const z = profile && profile.hr_zones
  if (z && z.length === 5 && z[1] > 0) return z
  const m = (profile && profile.hr_max) || (profile && profile.birth_year ? Math.round(208 - 0.7 * (new Date().getFullYear() - profile.birth_year)) : 190)
  return [0, Math.round(m * 0.69), Math.round(m * 0.76), Math.round(m * 0.83), Math.round(m * 0.9)]
}
export function zoneOf(zones, v) { let k = 1; for (let i = 1; i < 5; i++) if (v >= zones[i]) k = i + 1; return k }
export const ZONE_NAMES = ['Très facile', 'Facile', 'Modéré', 'Difficile', 'Très difficile']

/** Série d'une séance (secondes depuis le départ) à partir des mesures brutes par jour UTC (synchro Santé) */
export function seriesFromSamples(days, startMs, endMs) {
  const m = new Map()
  days.forEach(d => { const base = Date.parse(d.day + 'T00:00:00Z'); d.t.forEach((s, i) => { const ms = base + s * 1000; if (ms >= startMs - 60e3 && ms <= endMs + 120e3) m.set(Math.round((ms - startMs) / 1000), d.bpm[i]) }) })
  const t = [...m.keys()].sort((a, b) => a - b); return { t, bpm: t.map(k => m.get(k)) }
}
