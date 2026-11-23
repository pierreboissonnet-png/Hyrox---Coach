// Signalements de bugs : envoi (avec capture de l'écran prise au clic) et suivi par les administrateurs.
import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, List, Row, Seg, Switch, Sheet, Empty, Icon, Chips, useToast, useLoad } from '../ui.jsx'
import { BUG_ST, bugDate, download, dataUrlBlob, exportCsv, APP_VERSION } from '../lib/bugs.js'

export function BugSheet({ shot, ctx, onClose }) {
  const { profile } = useApp(), toast = useToast()
  const [text, setText] = useState(''), [withImg, setWithImg] = useState(true)
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  async function send() {
    if (text.trim().length < 3) return setMsg('Décrivez le problème en quelques mots.')
    setBusy(true); setMsg('')
    try {
      const r = await api.bugs.add({ text: text.trim().slice(0, 2000), pseudo: profile.display_name || '', ctx, img: withImg ? shot : null })
      api.bugs.triage(r.id).catch(() => {})   // premier diagnostic de Claude, en arrière-plan
      toast(`Merci ! Signalement n°${r.no} transmis aux administrateurs.`); onClose()
    } catch (e) { setBusy(false); setMsg(navigator.onLine === false ? 'Pas de réseau : réessayez une fois connecté (votre description reste dans le champ).' : /row-level|policy/i.test(e.message) ? 'Vous avez déjà 30 signalements en attente depuis 24 h : réessayez quand une partie aura été traitée.' : e.message || 'Envoi impossible, réessayez.') }
  }
  return <Sheet title="Signaler un problème" onClose={onClose} noBug actions={<button className="btn plain" onClick={send} disabled={busy}>Envoyer</button>}
    footer={<div className="row-gap"><button className="btn glass" onClick={onClose}>Annuler</button><button className="btn" style={{ flex: 1 }} onClick={send} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</button></div>}>
    <div data-bugsheet>
      <p className="small muted" style={{ marginTop: 0 }}>Un bouton qui ne répond pas, un temps faux, un affichage bizarre ? Décrivez-le : les administrateurs recevront votre description, la capture de l’écran et les informations techniques utiles.</p>
      <p className="small" style={{ margin: '0 0 8px' }}>Écran : <b>{ctx.ecran}</b>{ctx.erreurs.length ? <span className="bad"> · {ctx.erreurs.length} erreur(s) technique(s) détectée(s)</span> : ''}</p>
      <List><div className="row stack"><label className="small muted" htmlFor="bugT">Que se passe-t-il ?</label>
        <textarea id="bugT" rows={5} maxLength={2000} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Ex. le bouton Relais ne marche pas, le temps du SkiErg est faux, le texte dépasse de l’écran…" /></div></List>
      {shot ? <>
        <List className="" ><div className="row"><span className="label"><span className="t">Joindre la capture de l’écran</span><span className="s">Prise au moment du clic</span></span><Switch checked={withImg} onChange={setWithImg} label="Joindre la capture" /></div></List>
        {withImg && <img src={shot} alt="Capture de l'écran signalé" style={{ width: '100%', borderRadius: 16, marginTop: 10, boxShadow: 'var(--shadow)' }} />}
      </> : <p className="small muted">La capture d’écran n’a pas pu être réalisée sur cet appareil : votre description sera envoyée seule.</p>}
      {msg && <p className="err">{msg}</p>}
      <p className="foot">Aucune donnée de santé n’est jointe.</p>
    </div>
  </Sheet>
}

const LBL = { version: 'Version', ecran: 'Écran', route: 'Adresse', ecranTaille: "Taille d'écran", installee: 'Appli installée', reseau: 'Réseau', theme: 'Thème', appareil: 'Appareil', heureLocale: 'Heure (téléphone)' }

export function BugsPage() {
  const { user, profile, openBug } = useApp(), toast = useToast()
  const admin = useLoad(() => api.bugs.isAdmin(user.id), [])
  const list = useLoad(() => api.bugs.list(), [])
  const cfg = useLoad(() => admin.data ? api.bugs.apiConfig().catch(() => null) : null, [admin.data])
  const [f, setF] = useState('open'), [q, setQ] = useState(''), [open, setOpen] = useState(null), [msg, setMsg] = useState('')
  const all = list.data || []
  const inF = b => f === 'all' || (f === 'open' ? ['new', 'doing'].includes(b.status) : b.status === f)
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const L = useMemo(() => all.filter(b => inF(b) && (!q || norm([b.no, '#' + b.no, b.pseudo, b.text, b.ctx && b.ctx.ecran, b.ctx && b.ctx.version].join(' ')).includes(norm(q)))), [all, f, q])
  const n = k => all.filter(b => k === 'open' ? ['new', 'doing'].includes(b.status) : k === 'all' ? true : b.status === k).length
  async function exportJson() {
    const out = []
    for (let i = 0; i < L.length; i++) { setMsg(`Préparation… ${i + 1}/${L.length}`); let img = null; if (L[i].has_img) { try { img = (await api.bugs.get(L[i].id)).img } catch {} } out.push({ ...L[i], capture: img }) }
    setMsg(`${L.length} signalement(s) exporté(s).`)
    download(new Blob([JSON.stringify({ exporte: new Date().toISOString(), version: APP_VERSION, signalements: out }, null, 1)], { type: 'application/json' }), `signalements_${new Date().toISOString().slice(0, 10)}.json`)
  }
  return <Page back="#/moi" title="Signalements" subtitle={admin.data ? 'Les problèmes signalés par les membres, avec la capture de leur écran. Visible des seuls administrateurs.' : 'Vos signalements et leur suivi.'}
    actions={<button className="icon-btn glass" onClick={openBug} aria-label="Signaler un problème"><Icon name="plus" /></button>}>
    {admin.data && cfg.data && <div className="glass card small">
      <b>Suivi avec Claude</b> : accès API {cfg.data.off ? <b className="bad">coupé</b> : <b>actif</b>}{cfg.data.last ? ' · dernier accès ' + bugDate(cfg.data.last) + ` (${cfg.data.n || 0} appels)` : ' · jamais utilisé'}. Claude lit les signalements (sans adresse e-mail), met à jour leur statut et leur note de suivi.
      <div><button className="btn glass small" style={{ marginTop: 8 }} onClick={async () => { await api.bugs.setApiOff(!cfg.data.off); cfg.reload() }}>{cfg.data.off ? 'Rétablir l’accès' : 'Couper l’accès'}</button></div>
    </div>}
    <Chips value={f} onChange={setF} label="Filtrer" options={[['open', 'À traiter'], ['new', 'Nouveaux'], ['doing', 'En cours'], ['done', 'Résolus'], ['all', 'Tous']].map(([k, l]) => [k, `${l} (${n(k)})`])} />
    <List><div className="row"><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher : n°, membre, écran, mot…" style={{ width: '100%', textAlign: 'left', color: 'var(--ink)' }} /></div></List>
    {admin.data && <div className="row-gap" style={{ margin: '10px 0' }}><button className="btn glass small" onClick={() => exportCsv(L)}>Exporter (CSV)</button><button className="btn glass small" onClick={exportJson}>Exporter avec captures</button><span className="small muted">{msg}</span></div>}
    {L.length ? <List>{L.map(b => { const s = BUG_ST[b.status] || BUG_ST.new; return <Row key={b.id} title={<><span className="num faint">#{b.no}</span> {b.text.slice(0, 90)}{b.text.length > 90 ? '…' : ''}</>}
      sub={`${bugDate(b.created_at)} · ${b.pseudo} · ${(b.ctx && b.ctx.ecran) || ''}${b.has_img ? ' · capture' : ''}${b.analysis ? ' · diagnostic' : ''}${b.n_comments ? ' · ' + b.n_comments + ' échange(s)' : ''}${!admin.data && b.note ? ' · réponse' : ''}`} value={<span className={'badge ' + s[1]}>{s[0]}</span>} onClick={() => setOpen(b)} /> })}</List>
      : <div className="glass card"><Empty icon="bug">{list.loading ? 'Chargement…' : 'Aucun signalement.'}</Empty></div>}
    {open && <BugDetail bug={open} admin={!!admin.data} me={profile} onClose={() => setOpen(null)} onChange={keep => { list.reload(); if (!keep) setOpen(null) }} />}
  </Page>
}

/** Échanges : le membre apporte des précisions (texte, capture), l'équipe répond. Une précision remet le signalement « Nouveau ». */
function Thread({ bug, admin, me, onSent }) {
  const toast = useToast()
  const L = useLoad(() => api.bugs.comments(bug.id).catch(e => { if (/bug_comments/.test(e.message)) return null; throw e }), [bug.id])
  const [t, setT] = useState(''), [img, setImg] = useState(null), [busy, setBusy] = useState(false)
  if (L.data === null) return admin ? <p className="foot">Pour activer les échanges sur les signalements, exécutez le bloc « bug_comments » de supabase/schema.sql.</p> : null
  async function pick(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return
    const im = new Image(); im.onload = () => { const w = Math.min(900, im.width), c = document.createElement('canvas'); c.width = w; c.height = Math.round(im.height * w / im.width); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let u = c.toDataURL('image/jpeg', 0.7); if (u.length > 880000) u = c.toDataURL('image/jpeg', 0.45); setImg(u.length < 890000 ? u : null) }
    im.src = URL.createObjectURL(f)
  }
  async function send() {
    if (!t.trim()) return
    setBusy(true)
    try { await api.bugs.comment(bug.id, t.trim().slice(0, 2000), me.display_name || '', admin, img); setT(''); setImg(null); L.reload(); toast(admin ? 'Réponse envoyée' : 'Précision envoyée : le signalement repasse en « Nouveau »'); onSent && onSent() }
    catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  return <>
    <h2 className="sec">Échanges</h2>
    {(L.data || []).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>{L.data.map(c => <div key={c.id} style={{ alignSelf: c.from_admin ? 'flex-start' : 'flex-end', maxWidth: '88%', background: c.from_admin ? 'var(--fill)' : 'var(--accent-soft)', borderRadius: 14, padding: '8px 11px' }}>
      <div className="tiny muted">{c.from_admin ? 'Équipe' : c.pseudo} · {bugDate(c.created_at)}</div>
      <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
      {c.img && <img src={c.img} alt="Capture jointe" style={{ width: '100%', borderRadius: 10, marginTop: 6 }} />}
    </div>)}</div>}
    <List><div className="row stack">
      <textarea rows={3} maxLength={2000} value={t} onChange={e => setT(e.target.value)} placeholder={admin ? 'Répondre au membre…' : 'Apporter une précision : ce qui gêne, où, ce que vous attendiez…'} />
      <div className="row-gap small"><label className="btn glass small" style={{ cursor: 'pointer' }}><Icon name="upload" size={14} />{img ? 'Capture jointe ✓' : 'Joindre une capture'}<input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} /></label>
        {img && <button className="btn plain small" onClick={() => setImg(null)}>Retirer</button>}<span className="spacer" />
        <button className="btn small" disabled={busy || !t.trim()} onClick={send}>{busy ? 'Envoi…' : 'Envoyer'}</button></div>
    </div></List>
  </>
}

function BugDetail({ bug, admin, me, onClose, onChange }) {
  const toast = useToast()
  const full = useLoad(() => api.bugs.get(bug.id), [bug.id])
  const [st, setSt] = useState(bug.status), [note, setNote] = useState(bug.note || ''), [conf, setConf] = useState(false), [err, setErr] = useState('')
  const b = full.data || bug, c = b.ctx || {}
  async function save() { try { await api.bugs.update(b.id, { status: st, note }, me.display_name); toast('Signalement mis à jour.'); onChange() } catch (e) { setErr(e.message) } }
  async function del() { if (!conf) return setConf(true); try { await api.bugs.remove(b.id); toast('Signalement supprimé.'); onChange() } catch (e) { setErr(e.message) } }
  return <Sheet title={'Signalement n°' + b.no} onClose={onClose}>
    <p className="small muted" style={{ marginTop: 0 }}>{bugDate(b.created_at)} · <b>{b.pseudo}</b></p>
    {admin ? <div className="seg">{Object.entries(BUG_ST).map(([k, [l]]) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{l}</button>)}</div>
      : <p><span className={'badge ' + (BUG_ST[b.status] || BUG_ST.new)[1]}>{(BUG_ST[b.status] || BUG_ST.new)[0]}</span></p>}
    <div className="glass card" style={{ whiteSpace: 'pre-wrap' }}>{b.text}</div>
    {b.img ? <><img src={b.img} alt="Capture d'écran" style={{ width: '100%', borderRadius: 16 }} /><button className="btn glass small" style={{ marginTop: 6 }} onClick={() => download(dataUrlBlob(b.img), `signalement_${b.no}.jpg`)}>Télécharger la capture</button></>
      : <p className="small muted">{full.loading && b.has_img ? 'Chargement de la capture…' : 'Pas de capture.'}</p>}
    {b.analysis && <><h2 className="sec">Diagnostic de Claude</h2><div className="glass card coach small">{b.analysis}</div></>}
    <h2 className="sec">Contexte</h2>
    <List>{Object.entries(LBL).filter(([k]) => c[k]).map(([k, l]) => <Row key={k} title={l} value={<span className="small">{c[k]}</span>} />)}</List>
    {c.erreurs && c.erreurs.length > 0 && <details style={{ marginTop: 8 }}><summary className="small">Erreurs techniques ({c.erreurs.length})</summary><pre className="tiny mono" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.erreurs.map(e => `${e.t} [${e.type}] ${e.msg}${e.src ? ' @' + e.src : ''}${e.stack ? '\n' + e.stack : ''}`).join('\n')}</pre></details>}
    {c.actions && c.actions.length > 0 && <details style={{ marginTop: 6 }}><summary className="small">Dernières actions ({c.actions.length})</summary><pre className="tiny mono" style={{ whiteSpace: 'pre-wrap' }}>{c.actions.map(a => `${a.t} ${a.k} : ${a.v}`).join('\n')}</pre></details>}
    <h2 className="sec">Note de suivi</h2>
    {admin ? <List><div className="row stack"><textarea rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Analyse, correction prévue, version…" /></div></List>
      : <div className="glass card small">{b.note || 'Pas encore de réponse.'}</div>}
    <Thread bug={b} admin={admin} me={me} onSent={() => onChange(true)} />
    {b.updated_by && <p className="foot">Dernière mise à jour par {b.updated_by} le {bugDate(b.updated_at)}</p>}
    {err && <p className="err">{err}</p>}
    {admin && <div className="row-gap" style={{ marginTop: 12 }}><button className="btn" style={{ flex: 1 }} onClick={save}>Enregistrer</button><button className="btn glass" style={{ color: 'var(--bad)' }} onClick={del}>{conf ? 'Confirmer' : 'Supprimer'}</button></div>}
  </Sheet>
}

// ---------------- Analyses approfondies demandées (2e temps du coach) ----------------
const RQ = { new: ['En attente', 'bad'], doing: ['En cours', 'warn'], done: ['Traitée', 'good'], cancelled: ['Annulée', ''] }
export function requestsToMarkdown(L) {
  return `# Demandes d'analyse approfondie Hyrox Coach (${L.length})\n\nPour chaque demande : rédige une analyse approfondie en français (En bref ; Ce qui a marché ; À travailler, chiffré ; Prochaines séances ; réponse à la question), en t'appuyant sur les données et sur la 1re analyse de l'application. Pas de diagnostic médical.\n\n` +
    L.map(r => `## Demande n°${r.no} · ${r.pseudo} · ${new Date(r.created_at).toLocaleDateString('fr-FR')}\n${r.question ? `**Question** : ${r.question}\n` : ''}\n\`\`\`json\n${JSON.stringify(r.payload, null, 1)}\n\`\`\``).join('\n\n')
}
export function AnalysesPage() {
  const { user } = useApp(), toast = useToast()
  const admin = useLoad(() => api.bugs.isAdmin(user.id), [])
  const list = useLoad(() => api.coach.allRequests(), [])
  const [f, setF] = useState('open'), [open, setOpen] = useState(null), [ans, setAns] = useState('')
  const all = list.data || [], L = all.filter(r => f === 'all' || (f === 'open' ? ['new', 'doing'].includes(r.status) : r.status === f))
  async function copy() { try { await navigator.clipboard.writeText(requestsToMarkdown(L)); toast('Copié : collez-le dans Claude') } catch { download(new Blob([requestsToMarkdown(L)], { type: 'text/markdown' }), 'analyses-a-faire.md') } }
  return <Page back="#/moi" title="Analyses demandées" subtitle={admin.data ? '2e temps du coach : les demandes d’analyse approfondie, à traiter avec Claude.' : 'Vos demandes d’analyse approfondie.'}>
    <Seg value={f} onChange={setF} options={[['open', `À traiter (${all.filter(r => ['new', 'doing'].includes(r.status)).length})`], ['done', 'Traitées'], ['all', 'Toutes']]} />
    {admin.data && L.length > 0 && <><button className="btn glass block" onClick={copy}><Icon name="copy" size={18} />Copier pour Claude ({L.length})</button>
      <p className="foot">Collez dans Claude (claude.ai ou Cowork), puis déposez chaque réponse ci-dessous. Avec la clé d’accès (fonction « coach-api »), Claude peut aussi lire les demandes et déposer ses réponses lui-même.</p></>}
    {L.length ? <List>{L.map(r => <Row key={r.id} icon="spark" color="#5e5ce6" title={<><span className="num faint">#{r.no}</span> {r.pseudo}{r.question ? ' · ' + r.question.slice(0, 60) : ''}</>} sub={`${new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${r.session_id ? ((r.payload && r.payload.seance && r.payload.seance.nom) || 'séance') : 'ANALYSE GLOBALE'}`} value={<span className={'badge ' + RQ[r.status][1]}>{RQ[r.status][0]}</span>} onClick={() => { setOpen(r); setAns('') }} />)}</List>
      : <div className="glass card"><Empty icon="spark">{list.loading ? 'Chargement…' : 'Aucune demande.'}</Empty></div>}
    {open && <Sheet title={'Demande n°' + open.no} onClose={() => setOpen(null)}>
      <p className="small muted" style={{ marginTop: 0 }}>{open.pseudo} · {open.session_id ? <a href={'#/seance/' + open.session_id + '/coach'} onClick={() => setOpen(null)}>ouvrir la séance</a> : 'analyse globale (toutes les données)'}</p>
      {open.question && <div className="glass card">{open.question}</div>}
      <details><summary className="small">Données transmises</summary><pre className="tiny mono" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(open.payload, null, 1)}</pre></details>
      {admin.data && open.status !== 'done' && <>
        <div className="row-gap" style={{ margin: '10px 0' }}><button className="btn glass small" onClick={async () => { await api.coach.setRequest(open.id, { status: 'doing' }); list.reload(); setOpen({ ...open, status: 'doing' }) }}>Marquer « en cours »</button>
          <button className="btn glass small" onClick={async () => { try { await navigator.clipboard.writeText(requestsToMarkdown([open])); toast('Demande copiée') } catch {} }}><Icon name="copy" size={16} />Copier</button></div>
        <List><div className="row stack"><span className="small muted">Réponse de Claude (à coller ici)</span><textarea rows={8} value={ans} onChange={e => setAns(e.target.value)} /></div></List>
        <button className="btn block" style={{ marginTop: 10 }} disabled={ans.trim().length < 20} onClick={async () => { await api.coach.answer(open, ans.trim()); toast(open.session_id ? 'Analyse déposée dans la séance' : 'Analyse globale déposée'); list.reload(); setOpen(null) }}>Déposer l’analyse</button>
      </>}
    </Sheet>}
  </Page>
}
