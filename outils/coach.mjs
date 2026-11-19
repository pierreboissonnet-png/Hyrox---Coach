#!/usr/bin/env node
// Analyses approfondies (2e temps) depuis un terminal, ou par Claude dans Cowork.
// Variables : HYROX_URL (https://xxxx.supabase.co) et BUG_API_KEY (même clé que pour les signalements).
//   node outils/coach.mjs                       → demandes en attente (avec le résumé des séances)
//   node outils/coach.mjs 7                     → détail de la demande n°7 et 1re analyse de l'app
//   node outils/coach.mjs 7 doing               → marquer « en cours »
//   node outils/coach.mjs 7 repondre analyse.md → déposer l'analyse (fichier markdown) ; la demande passe « traitée »
import fs from 'node:fs'
const base = (process.env.HYROX_URL || '').replace(/\/$/, ''), key = process.env.BUG_API_KEY || ''
if (!base || key.length < 32) { console.error('Définissez HYROX_URL et BUG_API_KEY.'); process.exit(1) }
const url = base + '/functions/v1/coach-api', H = { 'x-bug-key': key, 'content-type': 'application/json' }
const call = async (q = '', opt = {}) => { const r = await fetch(url + q, { headers: H, ...opt }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j }
const [a, b, c] = process.argv.slice(2)
try {
  if (!a) {
    const { requests } = await call('?status=open')
    if (!requests.length) console.log('Aucune demande en attente.')
    for (const r of requests) console.log(`#${r.no} [${r.status}] ${r.created_at.slice(0, 16).replace('T', ' ')} · ${r.pseudo}${r.question ? ' · « ' + r.question + ' »' : ''}\n${JSON.stringify(r.payload)}\n`)
  } else if (!b) console.log(JSON.stringify(await call('?no=' + +a), null, 2))
  else if (b === 'repondre') console.log(await call('', { method: 'POST', body: JSON.stringify({ no: +a, analysis: fs.readFileSync(c, 'utf8') }) }))
  else console.log(await call('', { method: 'POST', body: JSON.stringify({ no: +a, status: b }) }))
} catch (e) { console.error('Erreur :', e.message); process.exit(1) }
