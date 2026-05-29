'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { LogEntry, DayType } from '@/lib/supabase'
import { TARGETS, DAY_TYPE_LABELS, QUICK_FOODS } from '@/lib/constants'

// ─── types ────────────────────────────────────────────────────────────────────
interface ChatItem { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; note?: string }
interface ChatResult { items: ChatItem[]; total_kcal: number; total_protein_g: number; overall_note?: string }
interface PhotoResult { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; note?: string }

// ─── helpers ──────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) {
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function parseJSON(raw: string) {
  try { return JSON.parse(raw) } catch (e) {}
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON found in response:\n' + raw.slice(0, 300))
  return JSON.parse(m[0])
}
function pct(val: number, max: number) { return Math.min(100, (val / max) * 100) + '%' }

// ─── PIN GATE ──────────────────────────────────────────────────────────────────
function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) })
    if (res.ok) { sessionStorage.setItem('unlocked', '1'); onUnlock() }
    else { setError('Wrong PIN'); setPin('') }
  }
  return (
    <div className="pin-screen">
      <div className="pin-title"><span>Fuel</span> Log</div>
      <input className="pin-input" type="password" inputMode="numeric" maxLength={6} placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
      <button className="pin-btn" onClick={submit}>Unlock</button>
      {error && <div className="pin-error">{error}</div>}
    </div>
  )
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => { if (sessionStorage.getItem('unlocked')) setUnlocked(true) }, [])
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />
  return <Tracker />
}

function Tracker() {
  const [date, setDate] = useState(today)
  const [dayType, setDayTypeState] = useState<DayType>('moderate')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  // chat state
  const [chatText, setChatText] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatResult, setChatResult] = useState<ChatResult | null>(null)
  const [chatChecked, setChatChecked] = useState<Set<number>>(new Set())
  const [chatError, setChatError] = useState('')

  // photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoResult, setPhotoResult] = useState<PhotoResult | null>(null)
  const [photoEdits, setPhotoEdits] = useState({ name: '', kcal: '', p: '', c: '', f: '' })
  const [photoError, setPhotoError] = useState('')

  // voice state
  const [micStatus, setMicStatus] = useState('Tap mic or type — describe what you ate')
  const [micActive, setMicActive] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  // manual add
  const [manualName, setManualName] = useState('')
  const [manualKcal, setManualKcal] = useState('')
  const [manualP, setManualP] = useState('')
  const [manualC, setManualC] = useState('')
  const [manualF, setManualF] = useState('')

  // plan ref
  const [planOpen, setPlanOpen] = useState(false)

  // drag over drop zone
  const [dzOver, setDzOver] = useState(false)

  const tgt = TARGETS[dayType]

  // ── load day ────────────────────────────────────────────────────────────────
  const loadDay = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/logs?date=${d}`)
      const data = await res.json()
      setEntries(data.entries ?? [])
      setDayTypeState(data.meta?.day_type ?? 'moderate')
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { loadDay(date) }, [date, loadDay])

  // ── voice ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setMicStatus('Voice not supported — type below instead'); return }
    const r = new SR()
    r.continuous = false; r.interimResults = true; r.lang = 'en-US'
    r.onstart = () => { setMicActive(true); setMicStatus('Listening…'); setTranscript('') }
    r.onresult = (e: any) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setTranscript(final || interim)
      if (final) setChatText(final)
    }
    r.onend = () => {
      setMicActive(false)
      setMicStatus('Done — tap Analyze to log')
      setChatText(prev => { if (prev) { setTimeout(() => sendChat(prev), 100); } return prev })
    }
    r.onerror = (e: any) => { setMicActive(false); setMicStatus('Error: ' + e.error) }
    recognitionRef.current = r
  }, []) // eslint-disable-line

  function toggleMic() {
    const r = recognitionRef.current
    if (!r) { alert('Voice not supported — type instead'); return }
    if (micActive) r.stop()
    else { setChatText(''); setTranscript(''); try { r.start() } catch (e) {} }
  }

  // ── day type ─────────────────────────────────────────────────────────────────
  async function setDayType(t: DayType) {
    setDayTypeState(t)
    await fetch('/api/logs', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date, day_type: t }) })
  }

  // ── change date ──────────────────────────────────────────────────────────────
  function changeDay(delta: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }

  // ── add entry ─────────────────────────────────────────────────────────────────
  async function addEntry(obj: { name: string; kcal: number; p: number; c: number; fat: number }, source: string) {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date, day_type: dayType, name: obj.name, kcal: obj.kcal, protein_g: obj.p, carbs_g: obj.c, fat_g: obj.fat, source }),
    })
    const data = await res.json()
    if (data.entry) setEntries(prev => [...prev, data.entry])
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/log/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function clearDay() {
    if (!confirm('Clear all entries for today?')) return
    await Promise.all(entries.map(e => fetch(`/api/log/${e.id}`, { method: 'DELETE' })))
    setEntries([])
  }

  // ── quick add ─────────────────────────────────────────────────────────────────
  function quickAdd(i: number) {
    const f = QUICK_FOODS[i]
    addEntry({ name: f.name, kcal: f.kcal, p: f.p, c: f.c, fat: f.f }, 'quick')
  }

  // ── manual add ────────────────────────────────────────────────────────────────
  function manualAdd() {
    if (!manualName && !manualKcal) return
    addEntry({ name: manualName || 'Meal', kcal: parseInt(manualKcal) || 0, p: parseInt(manualP) || 0, c: parseInt(manualC) || 0, fat: parseInt(manualF) || 0 }, 'manual')
    setManualName(''); setManualKcal(''); setManualP(''); setManualC(''); setManualF('')
  }

  // ── chat / AI ─────────────────────────────────────────────────────────────────
  async function sendChat(text?: string) {
    const t = text ?? chatText
    if (!t.trim()) return
    setChatLoading(true); setChatError(''); setChatResult(null)
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'chat', text: t }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const parsed = parseJSON(data.raw) as ChatResult
      if (!parsed.items?.length) throw new Error('No items found in response')
      setChatResult(parsed)
      setChatChecked(new Set(parsed.items.map((_, i) => i)))
    } catch (e: any) { setChatError(e.message || 'Unknown error') }
    setChatLoading(false)
  }

  function toggleChatItem(i: number) {
    setChatChecked(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })
  }

  async function logSelected() {
    if (!chatResult) return
    for (const [i, item] of chatResult.items.entries()) {
      if (chatChecked.has(i)) await addEntry({ name: item.name, kcal: item.kcal, p: item.protein_g, c: item.carbs_g, fat: item.fat_g }, 'voice')
    }
    setChatResult(null); setChatText(''); setTranscript('')
    setMicStatus('Tap mic or type below')
  }

  // ── photo ─────────────────────────────────────────────────────────────────────
  function handlePhotoFile(file: File) {
    if (!file.type.startsWith('image/')) return
    resetPhoto()
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target!.result as string
      setPhotoPreview(dataUrl)
      setPhotoLoading(true)
      const base64 = dataUrl.split(',')[1]
      try {
        const res = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'photo', image_base64: base64, image_mime: file.type }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        const parsed = parseJSON(data.raw) as PhotoResult
        setPhotoResult(parsed)
        setPhotoEdits({ name: parsed.name || '', kcal: String(parsed.kcal || ''), p: String(parsed.protein_g || ''), c: String(parsed.carbs_g || ''), f: String(parsed.fat_g || '') })
      } catch (e: any) { setPhotoError(e.message || 'Unknown error') }
      setPhotoLoading(false)
    }
    reader.readAsDataURL(file)
  }

  function logPhoto() {
    if (!photoResult) return
    addEntry({ name: photoEdits.name || photoResult.name, kcal: parseInt(photoEdits.kcal) || photoResult.kcal, p: parseInt(photoEdits.p) || photoResult.protein_g, c: parseInt(photoEdits.c) || photoResult.carbs_g, fat: parseInt(photoEdits.f) || photoResult.fat_g }, 'photo')
    resetPhoto()
  }

  function resetPhoto() { setPhotoPreview(null); setPhotoResult(null); setPhotoEdits({ name: '', kcal: '', p: '', c: '', f: '' }); setPhotoError(''); setPhotoLoading(false) }

  // ── totals ────────────────────────────────────────────────────────────────────
  const totals = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.protein_g, c: a.c + e.carbs_g, fat: a.fat + e.fat_g }), { kcal: 0, p: 0, c: 0, fat: 0 })
  const rem = tgt.kcal - totals.kcal
  const remClass = rem < 0 ? 'over' : rem < 200 ? 'close' : 'good'
  const remFill = rem < 0 ? '#c0392b' : rem < 200 ? '#f0c419' : '#4abe7c'
  const protClass = totals.p >= tgt.p ? 'ok' : totals.p >= tgt.p * 0.7 ? 'warn' : 'bad'

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* HEADER */}
      <div className="hdr">
        <div className="hdr-label">Fuel Log · Falmouth → Hyrox Boston</div>
        <div className="hdr-title"><span className="o">Daily</span> <span className="y">Fuel</span> Tracker</div>
        <div className="date-nav">
          <button onClick={() => changeDay(-1)}>◀</button>
          <div className="date-display">{fmtDate(date)}</div>
          <button onClick={() => changeDay(1)}>▶</button>
        </div>
      </div>

      {/* DAY TYPE */}
      <div className="day-strip">
        <div className="strip-label">Day type</div>
        <div className="type-btns">
          {(['rest','light','moderate','hard','race'] as DayType[]).map(t => (
            <button key={t} className={`type-btn${dayType === t ? ' active' : ''}`} data-type={t} onClick={() => setDayType(t)}>
              {DAY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="target-line">Target: <span>{tgt.kcal.toLocaleString()} kcal</span></div>
      </div>

      {/* SUMMARY */}
      <div className="summary">
        <div className="sum-grid">
          {[
            { cls: 'kcal', lbl: 'Calories', val: totals.kcal.toLocaleString(), tgt: `of ${tgt.kcal.toLocaleString()}`, bar: pct(totals.kcal, tgt.kcal) },
            { cls: 'prot', lbl: 'Protein',  val: totals.p + 'g',  tgt: `goal: ${tgt.p}g`, bar: pct(totals.p, tgt.p) },
            { cls: 'carb', lbl: 'Carbs',    val: totals.c + 'g',  tgt: `goal: ${tgt.c}g`, bar: pct(totals.c, tgt.c) },
            { cls: 'fat',  lbl: 'Fat',      val: totals.fat + 'g',tgt: `goal: ${tgt.f}g`, bar: pct(totals.fat, tgt.f) },
          ].map(s => (
            <div key={s.cls} className={`sm ${s.cls}`}>
              <div className="sm-lbl">{s.lbl}</div>
              <div className="sm-val">{s.val}</div>
              <div className="sm-tgt">{s.tgt}</div>
              <div className="sm-bar" style={{ width: s.bar }} />
            </div>
          ))}
        </div>
        <div className={`prot-status ${protClass}`}>
          <span>{totals.p >= tgt.p ? '✓' : '⚠'}</span>
          <span>
            {totals.p >= tgt.p ? `${totals.p}g protein — goal hit!` : totals.p >= tgt.p * 0.7 ? `${totals.p}g protein — ${tgt.p - totals.p}g to go` : `${totals.p}g protein — ${tgt.p - totals.p}g remaining. Hit ${tgt.p}g every day.`}
          </span>
        </div>
      </div>

      {/* PLAN REF */}
      <div className="plan-ref">
        <div className="pr-hdr" onClick={() => setPlanOpen(o => !o)}>
          <span className="pr-title">📋 Plan targets by day type</span>
          <span className={`pr-chev${planOpen ? ' open' : ''}`}>▼</span>
        </div>
        {planOpen && (
          <div className="pr-body">
            <table className="ptable">
              <thead><tr><th>Type</th><th>When</th><th className="tk">Kcal</th><th>P</th><th>C</th><th>F</th></tr></thead>
              <tbody>
                <tr><td>Rest</td><td>Sun down week</td><td className="tk">2,000</td><td>180g</td><td>175g</td><td>64g</td></tr>
                <tr><td>Light</td><td>Easy run / F45</td><td className="tk">2,200</td><td>180g</td><td>236g</td><td>59g</td></tr>
                <tr><td>Moderate</td><td>F45 + Peloton</td><td className="tk">2,400</td><td>180g</td><td>282g</td><td>61g</td></tr>
                <tr><td>Hard</td><td>Long run / race sim</td><td className="tk">2,600</td><td>180g</td><td>325g</td><td>64g</td></tr>
                <tr><td>Race Day</td><td>Max carbs</td><td className="tk">2,700</td><td>160g</td><td>371g</td><td>54g</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VOICE / CHAT */}
      <div className="section-wrap dark" style={{ marginTop: 12 }}>
        <div className="section-label">
          🎙️ Tell Claude what you ate
          <span className="badge badge-voice">VOICE</span>
          <span className="badge badge-ai">AI</span>
        </div>
        <div className="mic-row">
          <button className={`mic-btn${micActive ? ' listening' : ''}`} onClick={toggleMic}>🎙️</button>
          <div style={{ flex: 1 }}>
            <div className={`mic-status-text${micActive ? ' active' : ''}`}>{micStatus}</div>
            <div className={`transcript-box${transcript ? ' has-text' : ''}`}>{transcript || 'e.g. "I had overnight oats, chicken rice bowl, and a Quest bar"'}</div>
          </div>
        </div>
        <div className="chat-input-row">
          <input className="chat-input" type="text" placeholder="Or type it here…" value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
          <button className="chat-send-btn" disabled={chatLoading || !chatText.trim()} onClick={() => sendChat()}>
            {chatLoading ? '…' : 'Analyze →'}
          </button>
        </div>

        {(chatLoading || chatResult || chatError) && (
          <div className="chat-result" style={{ marginTop: 10 }}>
            <div className="chat-result-inner">
              {chatLoading && (
                <div className="thinking">
                  <div className="think-dots"><span /><span /><span /></div>
                  Analyzing your meal…
                </div>
              )}
              {chatError && <div className="error-text">⚠ {chatError}</div>}
              {chatResult && !chatLoading && (
                <>
                  <div className="chat-result-header">
                    <span>Tap ✓ to deselect</span>
                    <span style={{ color: '#4abe7c' }}>{chatResult.items.length} items</span>
                  </div>
                  {chatResult.items.map((item, i) => (
                    <div key={i} className="chat-item">
                      <div style={{ flex: 1 }}>
                        <div className="ci-name">{item.name}</div>
                        <div className="ci-macros">
                          <span className="ci-m k">{item.kcal} kcal</span>
                          <span className="ci-m p">{item.protein_g}g P</span>
                          <span className="ci-m c">{item.carbs_g}g C</span>
                          <span className="ci-m f">{item.fat_g}g F</span>
                        </div>
                        {item.note && <div className="ci-note">{item.note}</div>}
                      </div>
                      <button className={`ci-check${chatChecked.has(i) ? ' checked' : ''}`} onClick={() => toggleChatItem(i)}>✓</button>
                    </div>
                  ))}
                  <div className="chat-total">
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', color: '#555' }}>Total</span>
                    <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, color: '#f0c419' }}>{chatResult.total_kcal} kcal</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#f08070' }}>{chatResult.total_protein_g}g P</span>
                  </div>
                  {chatResult.overall_note && <div className="chat-note-text">{chatResult.overall_note}</div>}
                  <div className="chat-actions">
                    <button className="chat-log-btn" onClick={logSelected}>Log Selected</button>
                    <button className="chat-dismiss" onClick={() => setChatResult(null)}>Dismiss</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PHOTO SCAN */}
      <div className="section-wrap darker">
        <div className="section-label">
          📸 Scan a meal or label
          <span className="badge badge-photo">PHOTO AI</span>
        </div>
        <div
          className={`drop-zone${dzOver ? ' over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDzOver(true) }}
          onDragLeave={() => setDzOver(false)}
          onDrop={e => { e.preventDefault(); setDzOver(false); const f = e.dataTransfer.files[0]; if (f) handlePhotoFile(f) }}
          onClick={() => document.getElementById('file-inp')?.click()}
        >
          <div className="dz-icon">🍽️</div>
          <div className="dz-hint">
            <strong>Drop photo or tap to browse</strong>
            Meals, nutrition labels, packaged food
            <small>JPG · PNG · HEIC</small>
          </div>
          <input type="file" id="file-inp" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = '' }} />
        </div>
        <div className="photo-btns">
          <button className="photo-btn primary" onClick={() => document.getElementById('cam-inp')?.click()}>📷 Take Photo</button>
          <button className="photo-btn" onClick={() => document.getElementById('file-inp')?.click()}>🖼️ Library</button>
          <input type="file" id="cam-inp" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = '' }} />
        </div>

        {photoPreview && (
          <div className="photo-preview">
            <img src={photoPreview} alt="Scanned meal" />
            {photoLoading && (
              <div className="photo-overlay">
                <div className="photo-spinner" />
                <div className="photo-analyzing">Analyzing with Claude…</div>
              </div>
            )}
          </div>
        )}
        {photoError && <div className="photo-error-box">⚠ {photoError}</div>}
        {photoResult && !photoLoading && (
          <div className="photo-result">
            <div className="photo-res-title">AI Estimate <span className="badge badge-ai">CLAUDE</span></div>
            <div className="photo-food-name">{photoResult.name}</div>
            <div className="photo-macros">
              <div className="pm k"><div className="pm-lbl">Kcal</div><div className="pm-val">{photoResult.kcal}</div></div>
              <div className="pm p"><div className="pm-lbl">Protein</div><div className="pm-val">{photoResult.protein_g}g</div></div>
              <div className="pm c"><div className="pm-lbl">Carbs</div><div className="pm-val">{photoResult.carbs_g}g</div></div>
              <div className="pm f"><div className="pm-lbl">Fat</div><div className="pm-val">{photoResult.fat_g}g</div></div>
            </div>
            {photoResult.note && <div className="photo-note-text">{photoResult.note}</div>}
            <div className="photo-edit-row">
              <input className="pe-inp food" value={photoEdits.name} onChange={e => setPhotoEdits(p => ({ ...p, name: e.target.value }))} placeholder="Name" />
              <input className="pe-inp" value={photoEdits.kcal} onChange={e => setPhotoEdits(p => ({ ...p, kcal: e.target.value }))} placeholder="kcal" type="number" />
              <input className="pe-inp" value={photoEdits.p} onChange={e => setPhotoEdits(p => ({ ...p, p: e.target.value }))} placeholder="P" type="number" />
              <input className="pe-inp" value={photoEdits.c} onChange={e => setPhotoEdits(p => ({ ...p, c: e.target.value }))} placeholder="C" type="number" />
              <input className="pe-inp" value={photoEdits.f} onChange={e => setPhotoEdits(p => ({ ...p, f: e.target.value }))} placeholder="F" type="number" />
            </div>
            <div className="photo-edit-hint">Edit values if needed before logging</div>
            <div className="photo-actions">
              <button className="photo-log-btn" onClick={logPhoto}>+ Log This Meal</button>
              <button className="photo-retry-btn" onClick={resetPhoto}>Retry</button>
            </div>
          </div>
        )}
      </div>

      {/* QUICK ADD */}
      <div className="section-wrap">
        <div className="section-label">⚡ Quick add from your plan</div>
        <div className="quick-row">
          {QUICK_FOODS.map((f, i) => (
            <button key={i} className="qbtn" onClick={() => quickAdd(i)}>
              {f.name} <span className="qk">{f.kcal}cal·{f.p}gP</span>
            </button>
          ))}
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: '#555', margin: '13px 0 9px' }}>Manual entry</div>
        <div className="manual-row">
          <input className="mi-food" type="text" placeholder="Food / meal" value={manualName} onChange={e => setManualName(e.target.value)} onKeyDown={e => e.key === 'Enter' && manualAdd()} />
          <input className="mi-kcal" type="number" placeholder="kcal" value={manualKcal} onChange={e => setManualKcal(e.target.value)} />
          <input className="mi-p" type="number" placeholder="P" value={manualP} onChange={e => setManualP(e.target.value)} />
          <input className="mi-c" type="number" placeholder="C" value={manualC} onChange={e => setManualC(e.target.value)} />
          <input className="mi-f" type="number" placeholder="F" value={manualF} onChange={e => setManualF(e.target.value)} />
          <button className="add-btn" onClick={manualAdd}>+ Add</button>
        </div>
      </div>

      {/* LOG */}
      <div className="log-section">
        <div className="log-hdr">
          <span>Logged today</span>
          <button className="clear-btn" onClick={clearDay}>Clear day</button>
        </div>
        {loading ? (
          <div className="log-empty">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="log-empty">Nothing logged yet — use voice, photo, quick-add, or manual entry</div>
        ) : (
          entries.map(e => (
            <div key={e.id} className={`log-item${e.source === 'photo' ? ' from-photo' : e.source === 'voice' ? ' from-voice' : ''}`}>
              <div>
                <div className="li-name">
                  {e.source === 'photo' && <span>📷 </span>}
                  {e.source === 'voice' && <span>🎙️ </span>}
                  {e.name}
                </div>
                <div className="li-macros">
                  {e.kcal > 0 && <span className="li-m k">{e.kcal} kcal</span>}
                  {e.protein_g > 0 && <span className="li-m p">{e.protein_g}g P</span>}
                  {e.carbs_g > 0 && <span className="li-m c">{e.carbs_g}g C</span>}
                  {e.fat_g > 0 && <span className="li-m f">{e.fat_g}g F</span>}
                  <span className="li-time">{new Date(e.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              <div className="li-right">
                <div className="li-kcal">{e.kcal || '—'}</div>
                <button className="li-del" onClick={() => deleteEntry(e.id)}>×</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <div>
          <div className="bb-label">Remaining</div>
          <div className={`bb-val ${remClass}`}>{Math.abs(rem).toLocaleString()}{rem < 0 ? ' over' : ''}</div>
        </div>
        <div className="bb-prog">
          <div className="bb-track">
            <div className="bb-fill" style={{ width: pct(totals.kcal, tgt.kcal), background: remFill }} />
          </div>
        </div>
        <div className="bb-right">
          <div>Protein <span>{totals.p}g</span> / {tgt.p}g</div>
        </div>
      </div>
    </div>
  )
}
