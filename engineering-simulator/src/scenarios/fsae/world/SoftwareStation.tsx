import { Check, Cpu, Database, Network, Play, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DIFFERENCE_CHOICES, FEATURES, getSoftware, upsert } from '../config'
import { coneThreshold, dataRounds, modelWeights, score, testSet, trained, weightEquations, type DataRound } from '../sim/autonomy'
import type { FeatureId, FsaeObject, SoftwareObject } from '../types'
import { ObjectPic, type PicKind } from './Pictures'

type Step = 'data' | 'train' | 'validate'

const B_KIND: Record<FeatureId, PicKind> = { shape: 'barrel', color: 'post', stripe: 'hat', size: 'toy' }

export function SoftwareStation({ design, locked, fallbackSeed, onCommit }: { design: FsaeObject[]; locked: boolean; fallbackSeed: number; onCommit(next: FsaeObject[]): void }) {
  const existing = design.some((o) => o.kind === 'software')
  const sw: SoftwareObject = existing ? getSoftware(design) : { ...getSoftware(design), seed: fallbackSeed }
  const save = (patch: Partial<SoftwareObject>) => onCommit(upsert(design, { ...sw, ...patch }))
  const dataDone = sw.roundsDone >= FEATURES.length
  const [step, setStep] = useState<Step>(dataDone ? 'train' : 'data')

  const steps: { id: Step; label: string; icon: typeof Cpu; done: boolean; enabled: boolean }[] = [
    { id: 'data', label: '1 · Collect data', icon: Database, done: dataDone, enabled: true },
    { id: 'train', label: '2 · Train weights', icon: Network, done: sw.weights.every((w) => typeof w === 'number'), enabled: dataDone },
    { id: 'validate', label: '3 · Validate', icon: Play, done: sw.validatedAccuracy !== null && trained(sw), enabled: dataDone },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col items-center">
      {/* Monitor */}
      <div className="flex min-h-0 w-full max-w-[1100px] flex-1 flex-col rounded-[22px] bg-[#1b2a20] p-3 shadow-2xl">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl bg-[#0f1c15] text-[#dcefe2]">
          <aside className="flex w-[190px] shrink-0 flex-col gap-1 border-r border-white/10 bg-[#13241b] p-2.5">
            <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
              <Cpu className="size-4 text-[#9fe0b2]" />
              <span className="font-mono text-[13px] font-bold tracking-wide text-[#9fe0b2]">PitOS</span>
              <span className="font-mono text-[10px] text-white/40">v2.1</span>
            </div>
            <div className="px-1.5 pb-2 font-mono text-[10px] uppercase tracking-wider text-white/40">Driverless Lab</div>
            {steps.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={!s.enabled}
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left font-mono text-[12px] transition disabled:opacity-35 ${
                  step === s.id ? 'bg-[#9fe0b2] font-bold text-[#0f1c15]' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <s.icon className="size-3.5" />
                <span className="flex-1">{s.label}</span>
                {s.done && <Check className="size-3.5" strokeWidth={3} />}
              </button>
            ))}
            <div className="mt-auto rounded-lg bg-black/25 p-2 font-mono text-[10px] leading-relaxed text-white/55">
              The self-driving car must spot every cone on the course. Teach it what a cone looks like.
            </div>
          </aside>
          <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-5">
            {step === 'data' && <DataStep sw={sw} locked={locked} onDone={() => setStep('train')} save={save} />}
            {step === 'train' && <TrainStep sw={sw} locked={locked} save={save} onNext={() => setStep('validate')} />}
            {step === 'validate' && <ValidateStep sw={sw} locked={locked} save={save} />}
          </main>
        </div>
      </div>
      <div className="h-3 w-24 bg-[#1b2a20]" />
      <div className="h-2 w-48 rounded-t-lg bg-[#1b2a20]" />
    </div>
  )
}

// ---------------------------------------------------------------- 1. data

function DataStep({ sw, locked, save, onDone }: { sw: SoftwareObject; locked: boolean; save(p: Partial<SoftwareObject>): void; onDone(): void }) {
  const rounds = useMemo(() => dataRounds(sw.seed), [sw.seed])
  const [wrong, setWrong] = useState<string | null>(null)
  const [justFound, setJustFound] = useState<DataRound | null>(null)
  const done = sw.roundsDone >= rounds.length
  const round = rounds[Math.min(sw.roundsDone, rounds.length - 1)]

  if (justFound) {
    const n = rounds.indexOf(justFound) + 1
    const f = FEATURES.find((x) => x.id === justFound.feature)!
    return (
      <div>
        <Heading kicker={`Dataset ${n} of ${rounds.length}`} title={`Found it: ${justFound.answer}`} />
        <p className="mt-1 text-sm text-white/70">
          The computer now measures <b className="text-[#9fe0b2]">{f.label.toLowerCase()}</b> in every picture as input <b className="font-mono text-[#9fe0b2]">{f.symbol}</b>. 12 more pictures labeled:
        </p>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const cone = i % 3 !== 1
            return (
              <div key={i} className="animate-rise rounded-lg bg-white/5 p-1" style={{ animationDelay: `${i * 60}ms` }}>
                <ObjectPic kind={cone ? 'cone' : B_KIND[justFound.feature]} bg={i % 2 ? 'grass' : 'asphalt'} size={104} seed={i + n * 7} />
                <div className={`mt-1 text-center font-mono text-[10px] font-bold ${cone ? 'text-[#9fe0b2]' : 'text-[#f0a37a]'}`}>{cone ? 'CONE' : 'NOT A CONE'}</div>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setJustFound(null)
            if (sw.roundsDone >= rounds.length) onDone()
          }}
          className="mt-5 rounded-lg bg-[#9fe0b2] px-4 py-2 font-mono text-sm font-bold text-[#0f1c15] hover:bg-white"
        >
          {sw.roundsDone >= rounds.length ? 'All data collected → train the model' : 'Next dataset →'}
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div>
        <Heading kicker="Data" title="All 4 datasets collected" />
        <p className="mt-1 text-sm text-white/70">The model can now measure shape, color, stripe and size in every picture.</p>
        <button type="button" onClick={onDone} className="mt-4 rounded-lg bg-[#9fe0b2] px-4 py-2 font-mono text-sm font-bold text-[#0f1c15] hover:bg-white">
          Train the model →
        </button>
      </div>
    )
  }

  return (
    <div>
      <Heading kicker={`Dataset ${sw.roundsDone + 1} of ${rounds.length}`} title="What is different between these two pictures?" />
      <p className="mt-1 text-sm text-white/70">One is labeled CONE and one is labeled NOT A CONE. Only one thing changed.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        {(['A', 'B'] as const).map((which) => (
          <div key={which} className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
            <ObjectPic kind={which === 'A' ? 'cone' : B_KIND[round.feature]} bg={round.background} size={250} />
            <div className="mt-1.5 flex items-center justify-between px-1 font-mono text-xs">
              <span className="text-white/50">Picture {which}</span>
              <span className={`font-bold ${which === 'A' ? 'text-[#9fe0b2]' : 'text-[#f0a37a]'}`}>{which === 'A' ? 'CONE' : 'NOT A CONE'}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {DIFFERENCE_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={locked}
            onClick={() => {
              if (c === round.answer) {
                setWrong(null)
                setJustFound(round)
                save({ roundsDone: sw.roundsDone + 1 })
              } else {
                setWrong(c)
                save({ misses: sw.misses + 1 })
              }
            }}
            className={`rounded-lg px-4 py-2 font-mono text-sm font-bold ring-1 transition disabled:opacity-40 ${
              wrong === c ? 'animate-pop bg-[#5a2412] text-[#f0a37a] ring-[#f0a37a]/50' : 'bg-white/5 text-white ring-white/20 hover:bg-white/15'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {wrong && <p className="mt-2 font-mono text-xs text-[#f0a37a]">Both pictures have the same {wrong.toLowerCase()}. Look again.</p>}
    </div>
  )
}

// ---------------------------------------------------------------- 2. train

function TrainStep({ sw, locked, save, onNext }: { sw: SoftwareObject; locked: boolean; save(p: Partial<SoftwareObject>): void; onNext(): void }) {
  const eqs = useMemo(() => weightEquations(sw.seed), [sw.seed])
  const th = coneThreshold(sw.seed)
  const allAnswered = sw.weights.every((w) => typeof w === 'number')
  return (
    <div>
      <Heading kicker="Train" title="Find the weight for each input" />
      <p className="mt-1 max-w-[720px] text-sm text-white/70">
        The model is one neuron. It multiplies each measurement by its weight and adds them up: <span className="font-mono text-[#9fe0b2]">score = w₁x₁ + w₂x₂ + w₃x₃ + w₄x₄</span>. A score of{' '}
        <b className="font-mono text-[#9fe0b2]">{th}</b> or more means “cone”. Each training picture below has a known score. Solve for the missing weight.
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-5">
        <NeuronDiagram weights={sw.weights} threshold={th} />
        <div className="min-w-[380px] flex-1 space-y-2.5">
          {eqs.map((eq, k) => (
            <EquationCard
              key={`${k}:${sw.weights[k]}`}
              k={k}
              x={eq.x}
              target={eq.target}
              answers={sw.weights}
              locked={locked}
              onAnswer={(v) => save({ weights: sw.weights.map((w, i) => (i === k ? v : w)), validatedAccuracy: null })}
            />
          ))}
        </div>
      </div>
      {allAnswered && (
        <button type="button" onClick={onNext} className="mt-4 rounded-lg bg-[#9fe0b2] px-4 py-2 font-mono text-sm font-bold text-[#0f1c15] hover:bg-white">
          Test the model on new pictures →
        </button>
      )}
    </div>
  )
}

const sub = (i: number) => '₁₂₃₄'[i]

function EquationCard({ k, x, target, answers, locked, onAnswer }: { k: number; x: number[]; target: number; answers: (number | null)[]; locked: boolean; onAnswer(v: number | null): void }) {
  const mine = answers[k]
  const [text, setText] = useState(mine === null ? '' : String(mine))
  const terms = x.map((xi, i) => ({ xi, i })).filter((t) => t.xi > 0)
  const commit = () => {
    const t = text.trim()
    if (t === '') return onAnswer(null)
    const v = Number(t)
    if (Number.isFinite(v)) onAnswer(v)
  }
  const needed = terms.every((t) => typeof answers[t.i] === 'number')
  const lhs = terms.reduce((s, t) => s + t.xi * (answers[t.i] ?? 0), 0)
  const f = FEATURES[k]
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/45">
          Training picture {k + 1} · finds w{sub(k)} ({f.label})
        </span>
        <span className="font-mono text-[11px] text-white/45">
          {terms.map((t) => `${FEATURES[t.i].symbol}=${t.xi}`).join(', ')} · score {target}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="font-mono text-lg font-semibold text-white">
          {terms.map((t, j) => (
            <span key={t.i}>
              {j > 0 && ' + '}
              {t.xi}·w{sub(t.i)}
            </span>
          ))}{' '}
          = {target}
        </div>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-sm">
          w{sub(k)} =
          <input
            type="text"
            inputMode="decimal"
            value={text}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-16 rounded-md bg-black/40 px-2 py-1 text-center font-mono text-base font-bold text-[#9fe0b2] ring-1 ring-white/20 outline-none select-text focus:ring-[#9fe0b2]"
            placeholder="?"
          />
        </span>
      </div>
      {typeof mine === 'number' && needed && (
        <div className={`mt-1.5 font-mono text-xs ${lhs === target ? 'text-[#9fe0b2]' : 'text-[#f0a37a]'}`}>
          Check with your weights: {terms.map((t) => `${t.xi}×${answers[t.i]}`).join(' + ')} = {Math.round(lhs * 100) / 100} {lhs === target ? `✓ matches ${target}` : `✗ should be ${target}`}
        </div>
      )}
    </div>
  )
}

function NeuronDiagram({ weights, threshold }: { weights: (number | null)[]; threshold: number }) {
  return (
    <svg width="300" height="250" viewBox="0 0 300 250" className="shrink-0 rounded-xl bg-black/20">
      {FEATURES.map((f, i) => {
        const y = 35 + i * 58
        const w = weights[i]
        return (
          <g key={f.id}>
            <line x1="62" y1={y} x2="200" y2="125" stroke={typeof w === 'number' ? '#9fe0b2' : '#ffffff33'} strokeWidth={typeof w === 'number' ? 1 + Math.min(5, Math.abs(w)) : 1.5} strokeDasharray={typeof w === 'number' ? undefined : '4 4'} />
            <circle cx="40" cy={y} r="22" fill="#13241b" stroke="#9fe0b2" strokeOpacity="0.5" />
            <text x="40" y={y - 2} textAnchor="middle" fontSize="12" fontFamily="IBM Plex Mono, monospace" fill="#fff" fontWeight="700">
              {f.symbol}
            </text>
            <text x="40" y={y + 11} textAnchor="middle" fontSize="8" fontFamily="IBM Plex Mono, monospace" fill="#ffffff99">
              {f.label}
            </text>
            <text x={112} y={y + (125 - y) * 0.36 - 6} textAnchor="middle" fontSize="11" fontFamily="IBM Plex Mono, monospace" fill="#9fe0b2" stroke="#10201a" strokeWidth={4} paintOrder="stroke" fontWeight="700">
              w{sub(i)}={typeof w === 'number' ? w : '?'}
            </text>
          </g>
        )
      })}
      <circle cx="222" cy="125" r="26" fill="#9fe0b2" />
      <text x="222" y="132" textAnchor="middle" fontSize="20" fontFamily="IBM Plex Mono, monospace" fill="#0f1c15" fontWeight="700">
        Σ
      </text>
      <text x="222" y="172" textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#ffffffaa">
        score ≥ {threshold}
      </text>
      <text x="222" y="186" textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#ffffffaa">
        → “cone”
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------- 3. validate

function ValidateStep({ sw, locked, save }: { sw: SoftwareObject; locked: boolean; save(p: Partial<SoftwareObject>): void }) {
  const items = useMemo(() => testSet(sw.seed), [sw.seed])
  const th = coneThreshold(sw.seed)
  const w = modelWeights(sw)
  const results = items.map((it) => (score(w, it.x) >= th) === it.isCone)
  const [shown, setShown] = useState<number | null>(null)
  const ready = trained(sw)

  const right = results.filter(Boolean).length
  useEffect(() => {
    if (shown === null || shown >= items.length) return
    const t = window.setTimeout(() => {
      const next = shown + 1
      setShown(next)
      // Save the score once, when the last tile is revealed.
      if (next === items.length) save({ validatedAccuracy: right / items.length })
    }, 55)
    return () => clearTimeout(t)
  }, [shown, items.length, save, right])
  const finished = shown !== null && shown >= items.length

  const kinds: PicKind[] = ['barrel', 'post', 'hat', 'toy']
  return (
    <div>
      <Heading kicker="Validate" title="Test the model on 40 pictures it has never seen" />
      <p className="mt-1 text-sm text-white/70">Half are cones, half are look-alikes. Each tile shows whether the model got it right.</p>
      <button
        type="button"
        disabled={locked || !ready || (shown !== null && !finished)}
        onClick={() => setShown(0)}
        className="mt-3 flex items-center gap-2 rounded-lg bg-[#9fe0b2] px-4 py-2 font-mono text-sm font-bold text-[#0f1c15] hover:bg-white disabled:opacity-40"
      >
        <Play className="size-4" /> {finished ? 'Run validation again' : 'Run validation'}
      </button>
      {!ready && <p className="mt-2 font-mono text-xs text-[#f0a37a]">Every weight needs a number first.</p>}
      {shown !== null && (
        <>
          <div className="mt-4 grid grid-cols-10 gap-1.5">
            {items.slice(0, shown).map((it, i) => (
              <div key={i} className={`relative rounded-md p-0.5 ring-2 ${results[i] ? 'ring-[#9fe0b2]' : 'ring-[#f0a37a]'}`}>
                <ObjectPic kind={it.isCone ? 'cone' : kinds[i % 4]} bg={i % 3 ? 'asphalt' : 'grass'} size={64} seed={i} />
                <span className={`absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full ${results[i] ? 'bg-[#9fe0b2] text-[#0f1c15]' : 'bg-[#f0a37a] text-[#0f1c15]'}`}>
                  {results[i] ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                </span>
              </div>
            ))}
          </div>
          {finished && (
            <div className="mt-4 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="font-mono text-[11px] uppercase tracking-wider text-white/45">Validation accuracy</div>
              <div className={`font-mono text-3xl font-bold ${right === items.length ? 'text-[#9fe0b2]' : 'text-[#f0a37a]'}`}>{Math.round((right / items.length) * 100)}%</div>
              <div className="font-mono text-xs text-white/60">
                {right} of {items.length} right · {results.filter((r, i) => !r && items[i].isCone).length} cones missed · {results.filter((r, i) => !r && !items[i].isCone).length} look-alikes called cones
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <div className="font-mono text-[11px] uppercase tracking-widest text-[#9fe0b2]/80">{kicker}</div>
      <h3 className="font-display text-2xl font-bold text-white">{title}</h3>
    </>
  )
}
