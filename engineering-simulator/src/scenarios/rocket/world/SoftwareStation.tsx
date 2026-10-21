import { AlertCircle, BookOpen, CheckCircle2, Cpu, SlidersHorizontal, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { getSoftware, upsert } from '../config'
import type { RocketResult } from '../sim/engine'
import { compile, SETTING_RANGES, SETTINGS, starterProgram, type CompileError } from '../sim/rocketScript'
import type { RocketObject, SoftwareObject } from '../types'
import { play } from '../../../shared/audio/sfx'

export function SoftwareStation({
  design,
  locked,
  onCommit,
  newSeed,
  lastResult,
}: {
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  newSeed(): number
  lastResult: RocketResult | null
}) {
  const sw = getSoftware(design)
  if (!sw?.pluggedIn) {
    return (
      <PlugIn
        locked={locked}
        onPlug={() => {
          const seed = newSeed()
          const source = starterProgram(seed).source
          onCommit(upsert(design, { id: 'station:software', kind: 'software', seed, pluggedIn: true, source, uploadedSource: null, updatedAt: 1 }))
        }}
      />
    )
  }
  return <Ide key={sw.seed} sw={sw} design={design} locked={locked} onCommit={onCommit} lastResult={lastResult} />
}

// ---------------------------------------------------------------- plug in

const PORT = { x: 0.78, y: 0.52 }

function PlugIn({ locked, onPlug }: { locked: boolean; onPlug(): void }) {
  const box = useRef<HTMLDivElement>(null)
  const [plug, setPlug] = useState({ x: 0.5, y: 0.82 })
  const [dragging, setDragging] = useState(false)
  const [lit, setLit] = useState(false)

  const toLocal = (e: ReactPointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  useEffect(() => {
    if (!lit) return
    play('pop')
    const id = window.setTimeout(onPlug, 900)
    return () => clearTimeout(id)
  }, [lit, onPlug])

  const near = Math.hypot(plug.x - PORT.x, (plug.y - PORT.y) * 0.6) < 0.05

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div ref={box} className="relative aspect-[2.2/1] w-full max-w-[900px] select-none rounded-3xl bg-[#d9cfb9] ring-1 ring-line">
        {/* Laptop */}
        <div className="absolute left-[6%] top-[10%] h-[62%] w-[46%] rounded-2xl bg-[#1b2a20] p-[1.2%] shadow-xl">
          <div className="grid h-full place-items-center rounded-lg bg-[#0f1813] text-center">
            <div>
              <Cpu className="mx-auto size-9 text-white/30" />
              <div className="mt-2 font-mono text-sm text-white/60">{lit ? 'Flight computer found…' : 'No flight computer connected'}</div>
              <div className="mt-1 font-mono text-xs text-white/35">RocketScript IDE</div>
            </div>
          </div>
        </div>
        <div className="absolute left-[2%] top-[72%] h-[6%] w-[54%] rounded-b-2xl bg-[#8f978f]" />
        {/* USB cable from the laptop to the plug */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 45" preserveAspectRatio="none">
          <path d={`M52 34 C 60 44, ${plug.x * 100 - 8} ${plug.y * 45 + 6}, ${plug.x * 100 - 2} ${plug.y * 45}`} stroke="#1b2a20" strokeWidth={0.9} fill="none" />
        </svg>
        {/* Flight computer board */}
        <div className="absolute left-[64%] top-[22%] h-[60%] w-[30%] rounded-xl bg-[#2c5b3c] p-3 shadow-lg ring-2 ring-[#1d4029]">
          <div className="font-mono text-[11px] font-bold text-white/80">FLIGHT COMPUTER</div>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className="h-1.5 rounded-sm bg-[#d9a52b]/70" />
            ))}
          </div>
          <div className="mt-3 h-10 w-16 rounded bg-[#1b2a20]" />
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            <span className={`size-3 rounded-full ${lit ? 'bg-[#4ade80] shadow-[0_0_12px_4px_#4ade80]' : 'bg-[#3a3f3a]'}`} />
            <span className="font-mono text-[10px] text-white/70">PWR</span>
          </div>
        </div>
        {/* USB port */}
        <div
          className={`absolute h-[9%] w-[3.5%] -translate-x-1/2 -translate-y-1/2 rounded-sm ring-2 ${near && dragging ? 'bg-[#4ade80]/40 ring-[#4ade80]' : 'bg-[#0f1813] ring-white/60'}`}
          style={{ left: `${PORT.x * 100}%`, top: `${PORT.y * 100}%` }}
        />
        {/* Plug */}
        {!lit && (
          <div
            onPointerDown={(e) => {
              if (locked) return
              e.currentTarget.setPointerCapture(e.pointerId)
              setDragging(true)
            }}
            onPointerMove={(e) => dragging && setPlug(toLocal(e))}
            onPointerUp={() => {
              setDragging(false)
              if (near) {
                setPlug(PORT)
                setLit(true)
              }
            }}
            className="absolute h-[10%] w-[5%] -translate-x-full -translate-y-1/2 cursor-grab touch-none rounded-md bg-[#e9e4d6] shadow-lg ring-2 ring-[#1b2a20] active:cursor-grabbing"
            style={{ left: `${plug.x * 100}%`, top: `${plug.y * 100}%` }}
          >
            <span className="absolute -right-[18%] top-1/2 h-1/2 w-[22%] -translate-y-1/2 rounded-r-sm bg-[#9aa3ad]" />
          </div>
        )}
      </div>
      <p className="text-sm text-ink/60">{lit ? 'Green light: the flight computer has power and a connection.' : 'Drag the USB plug into the port on the flight computer.'}</p>
    </div>
  )
}

// ---------------------------------------------------------------- IDE

const KEYWORDS = new Set(['SET', 'ON', 'END', 'IGNITE', 'CUTOFF', 'DEPLOY', 'WAIT', 'UNTIL', 'LOG', 'BEEP'])
const OBJECTS = new Set(['engine', 'parachute', 'altitude', 'launch', 'falling'])

/** Colors one line of RocketScript. Numbers on top-level SET lines are marked as the tunable ones. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = []
  const tunable = /^SET\s/i.test(line)
  const re = /(\/\/.*$)|("[^"]*"?)|([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|(\s+)|(.)/g
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(line))) {
    const [tok, comment, str, word, num] = m
    const k = i++
    if (comment) out.push(<span key={k} className="text-[#7d8a80]">{tok}</span>)
    else if (str) out.push(<span key={k} className="text-[#e3b341]">{tok}</span>)
    else if (word && KEYWORDS.has(word.toUpperCase())) out.push(<span key={k} className="font-semibold text-[#c79bff]">{tok}</span>)
    else if (word && (SETTINGS as readonly string[]).includes(word.toLowerCase())) out.push(<span key={k} className="text-[#8fd19e]">{tok}</span>)
    else if (word && OBJECTS.has(word.toLowerCase())) out.push(<span key={k} className="text-[#f0a68a]">{tok}</span>)
    else if (num)
      out.push(
        <span key={k} className={tunable ? 'rounded bg-[#d9a52b]/25 text-[#ffd479] outline outline-1 outline-[#d9a52b]/60' : 'text-[#ffd479]'}>
          {tok}
        </span>,
      )
    else out.push(<span key={k}>{tok}</span>)
  }
  return out
}

const LINE_H = 19

function Ide({
  sw,
  design,
  locked,
  onCommit,
  lastResult,
}: {
  sw: SoftwareObject
  design: RocketObject[]
  locked: boolean
  onCommit(next: RocketObject[]): void
  lastResult: RocketResult | null
}) {
  const [draft, setDraft] = useState(sw.source)
  const [seenSource, setSeenSource] = useState(sw.source)
  const [focused, setFocused] = useState(false)
  const [showRef, setShowRef] = useState(true)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const pre = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)

  // A teammate's saved edit replaces ours only while we're not typing.
  if (sw.source !== seenSource && !focused) {
    setSeenSource(sw.source)
    setDraft(sw.source)
  }

  const result = compile(draft)
  const errors: CompileError[] = result.errors
  const errorLines = new Set(errors.map((e) => e.line))
  const lines = draft.split('\n')
  const uploaded = sw.uploadedSource !== null && sw.uploadedSource === draft

  const save = (source: string, extra: Partial<SoftwareObject> = {}) => {
    setSeenSource(source)
    onCommit(upsert(design, { ...sw, source, ...extra, updatedAt: sw.updatedAt + 1 }))
  }

  // Autosave a moment after typing stops, so teammates (and the checklist) see the latest code.
  useEffect(() => {
    if (draft === sw.source || locked) return
    const id = window.setTimeout(() => save(draft), 900)
    return () => clearTimeout(id)
  })

  const upload = () => {
    if (locked) return
    if (!result.ok) {
      play('buzz')
      setMessage({ ok: false, text: `Upload failed: ${errors.length} problem${errors.length > 1 ? 's' : ''} in the code.` })
      return
    }
    play('chime')
    save(draft, { uploadedSource: draft })
    setMessage({ ok: true, text: 'Uploaded. The flight computer will run this program at launch.' })
  }

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[#14201a] shadow-xl ring-4 ring-[#1b2a20]">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#1b2a20] px-3 py-2">
          <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs text-white/80">flight.rks</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#8fd19e]">
            <span className="size-2 rounded-full bg-[#4ade80] shadow-[0_0_6px_2px_#4ade8088]" /> flight computer connected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setShowRef((v) => !v)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${showRef ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}>
              <BookOpen className="size-3.5" /> Reference
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={upload}
              className="btn-press flex items-center gap-1.5 rounded-lg bg-[#4f9a5c] px-3 py-1.5 font-display text-xs font-bold text-white disabled:opacity-50"
            >
              <Upload className="size-3.5" /> Upload to rocket
            </button>
          </div>
        </div>

        {/* Tip: the numbers are theirs to change */}
        <div className="flex shrink-0 items-start gap-2 border-b border-[#d9a52b]/30 bg-[#d9a52b]/15 px-4 py-2 text-[12.5px] text-[#ffe3a3]">
          <SlidersHorizontal className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>The highlighted numbers are yours to change.</strong> <code className="font-mono">throttle</code> sets engine power, <code className="font-mono">burn_time</code> sets
            how long the engine fires, and <code className="font-mono">deploy_altitude</code> sets when the parachute opens. Change them, upload, launch, and see what
            happens to the speed and height.
          </span>
        </div>

        {/* Editor */}
        <div className="relative flex min-h-0 flex-1 font-mono text-[13px]">
          <div ref={gutter} className="w-14 shrink-0 overflow-hidden border-r border-white/10 bg-[#111b16] py-3 text-right text-white/35">
            {lines.map((_, i) => (
              <div key={i} className="relative pr-3" style={{ height: LINE_H, lineHeight: `${LINE_H}px` }}>
                {errorLines.has(i + 1) && <span className="absolute left-1.5 top-[6px] size-2.5 rounded-full bg-[#ef6b5a]" />}
                {i + 1}
              </div>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <pre ref={pre} aria-hidden className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre px-4 py-3 text-[#e7efe9]" style={{ lineHeight: `${LINE_H}px` }}>
              {lines.map((l, i) => (
                <div key={i} className={errorLines.has(i + 1) ? 'bg-[#ef6b5a]/15 underline decoration-[#ef6b5a] decoration-wavy underline-offset-4' : ''} style={{ height: LINE_H }}>
                  {highlight(l)}
                  {'​'}
                </div>
              ))}
            </pre>
            <textarea
              value={draft}
              readOnly={locked}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false)
                if (draft !== sw.source && !locked) save(draft)
              }}
              onChange={(e) => {
                setDraft(e.target.value)
                setMessage(null)
              }}
              onScroll={(e) => {
                if (pre.current) {
                  pre.current.scrollTop = e.currentTarget.scrollTop
                  pre.current.scrollLeft = e.currentTarget.scrollLeft
                }
                if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Tab') return
                e.preventDefault()
                const t = e.currentTarget
                const { selectionStart: a, selectionEnd: b } = t
                const next = draft.slice(0, a) + '    ' + draft.slice(b)
                setDraft(next)
                requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4))
              }}
              className="absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent px-4 py-3 text-transparent caret-white outline-none selection:bg-white/20"
              style={{ lineHeight: `${LINE_H}px` }}
            />
          </div>
        </div>

        {/* Problems / output */}
        <div className="h-[112px] shrink-0 overflow-y-auto border-t border-white/10 bg-[#0f1813] px-4 py-2 font-mono text-[12.5px]">
          <div className="mb-1 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/45">
            <span>Problems ({errors.length})</span>
            <span className={uploaded ? 'text-[#8fd19e]' : 'text-[#e3b341]'}>
              {uploaded ? '● running on the flight computer' : sw.uploadedSource ? '● edited since last upload' : '● not uploaded yet'}
            </span>
          </div>
          {message && (
            <div className={`mb-1 flex items-center gap-1.5 ${message.ok ? 'text-[#8fd19e]' : 'text-[#ef6b5a]'}`}>
              {message.ok ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />} {message.text}
            </div>
          )}
          {errors.length === 0 ? (
            <div className="text-[#8fd19e]">No problems found. The program compiles.</div>
          ) : (
            errors.map((e, i) => (
              <div key={i} className="text-[#f2a093]">
                <span className="text-white/45">line {e.line}:</span> {e.message}
              </div>
            ))
          )}
          {lastResult && lastResult.log.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-1.5 text-white/60">
              <div className="text-[11px] uppercase tracking-wider text-white/40">Last flight log</div>
              {lastResult.log.map((l, i) => (
                <div key={i}>
                  T+{l.t.toFixed(1)}s {l.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showRef && <Reference />}
    </div>
  )
}

function Reference() {
  const row = (code: string, what: string) => (
    <div className="border-b border-line py-1.5 last:border-0">
      <code className="font-mono text-[12px] font-semibold text-[#5b3c94]">{code}</code>
      <div className="text-xs text-ink/65">{what}</div>
    </div>
  )
  return (
    <aside className="w-[280px] shrink-0 overflow-y-auto rounded-2xl bg-white p-4 ring-1 ring-line">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold">
        <BookOpen className="size-4" /> RocketScript reference
      </h3>
      <div className="mt-2">
        {row('SET name = number', 'Stores a number in a setting.')}
        {row('ON launch: … END', 'Runs when the countdown ends.')}
        {row('ON falling: … END', 'Runs once the altimeter senses the rocket coming down.')}
        {row('IGNITE engine', 'Lights the motor.')}
        {row('CUTOFF engine', 'Shuts the motor off.')}
        {row('WAIT seconds', 'Pauses the block, e.g. WAIT 2 or WAIT burn_time.')}
        {row('WAIT UNTIL altitude < feet', 'Pauses until the height passes a value (also >).')}
        {row('DEPLOY parachute', 'Fires the ejection charge.')}
        {row('LOG "text"', 'Writes a line to the flight log.')}
        {row('// comment', 'Ignored by the computer.')}
      </div>
      <h4 className="mt-3 text-[11px] font-bold uppercase tracking-wider text-ink/50">Settings</h4>
      {SETTINGS.map((s) => (
        <div key={s} className="py-1 text-xs">
          <code className="font-mono font-semibold text-forest">{s}</code>{' '}
          <span className="text-ink/50">
            ({SETTING_RANGES[s].min}–{SETTING_RANGES[s].max} {SETTING_RANGES[s].unit})
          </span>
          <div className="text-ink/65">{SETTING_RANGES[s].meaning}</div>
        </div>
      ))}
    </aside>
  )
}
