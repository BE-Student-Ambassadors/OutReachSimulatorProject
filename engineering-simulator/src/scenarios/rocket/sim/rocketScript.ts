import { mulberry32, pick, shuffle } from './rng'

/**
 * RocketScript: the tiny language the flight computer runs.
 *
 *   SET throttle = 70            settings: throttle (0-100 %), burn_time (s), deploy_altitude (ft)
 *   ON launch:  ...  END         runs from the moment the countdown ends
 *   ON falling: ...  END         runs once the rocket starts coming down (needs the altimeter)
 *   IGNITE engine / CUTOFF engine / DEPLOY parachute
 *   WAIT 2  |  WAIT burn_time  |  WAIT UNTIL altitude < 500
 *   LOG "text"  |  BEEP          // comments run to the end of the line
 *
 * Keywords are not case sensitive. The compiler reports what is wrong and where, never what to type.
 */

export const SETTINGS = ['throttle', 'burn_time', 'deploy_altitude'] as const
export type SettingName = (typeof SETTINGS)[number]

export const SETTING_RANGES: Record<SettingName, { min: number; max: number; unit: string; meaning: string }> = {
  throttle: { min: 0, max: 100, unit: '%', meaning: 'Engine power. 100 is full power.' },
  burn_time: { min: 0, max: 20, unit: 's', meaning: 'A number of seconds, for use with WAIT.' },
  deploy_altitude: { min: 0, max: 5000, unit: 'ft', meaning: 'A height in feet, for use with WAIT UNTIL.' },
}

/** What a setting holds before any SET runs. */
export const SETTING_DEFAULTS: Record<SettingName, number> = { throttle: 100, burn_time: 0, deploy_altitude: 0 }

export type EventName = 'launch' | 'falling'
export type Value = number | SettingName

export type Instr =
  | { op: 'ignite' | 'cutoff' | 'deploy' | 'beep'; line: number }
  | { op: 'log'; text: string; line: number }
  | { op: 'wait'; value: Value; line: number }
  | { op: 'waitUntil'; cmp: '<' | '>'; value: Value; line: number }
  | { op: 'set'; name: SettingName; value: number; line: number }

export interface Program {
  /** Values after the top-level SET lines. */
  settings: Record<SettingName, number>
  blocks: Partial<Record<EventName, Instr[]>>
}

export interface CompileError {
  line: number
  message: string
}

export type CompileResult = { ok: true; program: Program; errors: [] } | { ok: false; program: null; errors: CompileError[] }

type Token = { kind: 'word'; text: string } | { kind: 'string'; text: string } | { kind: 'sym'; text: string }

function tokenize(src: string, line: number, errors: CompileError[]): Token[] | null {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t') {
      i++
    } else if (ch === '/' && src[i + 1] === '/') {
      break
    } else if (ch === '"') {
      const end = src.indexOf('"', i + 1)
      if (end < 0) {
        errors.push({ line, message: 'This text starts with " but is never closed with a second ".' })
        return null
      }
      out.push({ kind: 'string', text: src.slice(i + 1, end) })
      i = end + 1
    } else if ('=<>:'.includes(ch)) {
      out.push({ kind: 'sym', text: ch })
      i++
    } else if (/[A-Za-z0-9_.]/.test(ch)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++
      out.push({ kind: 'word', text: src.slice(i, j) })
      i = j
    } else {
      errors.push({ line, message: `Unexpected character ${ch}` })
      return null
    }
  }
  return out
}

const isSetting = (w: string): w is SettingName => (SETTINGS as readonly string[]).includes(w.toLowerCase())
const isNumber = (w: string) => /^\d+(\.\d+)?$/.test(w)
const show = (t: Token | undefined) => (t ? (t.kind === 'string' ? `"${t.text}"` : t.text) : '')

export function compile(source: string): CompileResult {
  const errors: CompileError[] = []
  const settings = { ...SETTING_DEFAULTS }
  const blocks: Partial<Record<EventName, Instr[]>> = {}
  // An ON line with a mistake still opens its block, so one slip doesn't flag every line inside it.
  let open: { event: EventName | null; line: number; body: Instr[] } | null = null
  const close = () => {
    if (open?.event && !blocks[open.event]) blocks[open.event] = open.body
    open = null
  }

  const lines = source.split('\n')
  lines.forEach((raw, idx) => {
    const line = idx + 1
    const toks = tokenize(raw, line, errors)
    if (!toks || toks.length === 0) return
    const err = (message: string) => errors.push({ line, message })
    const first = toks[0]
    if (first.kind !== 'word') return err(`A line can't start with ${show(first)}.`)
    const cmd = first.text.toUpperCase()
    const rest = toks.slice(1)
    const extra = (n: number) => {
      if (rest.length > n) {
        err(`Unexpected ${show(rest[n])} at the end of the line.`)
        return true
      }
      return false
    }
    const needBlock = () => {
      if (!open) {
        err(`${cmd} has to be inside an ON block.`)
        return false
      }
      return true
    }
    /** A number of seconds/feet, or the name of a setting. */
    const value = (t: Token | undefined, what: string): Value | null => {
      if (!t) {
        err(`${what} is missing a number or setting.`)
        return null
      }
      if (t.kind === 'word' && isNumber(t.text)) return Number(t.text)
      if (t.kind === 'word' && isSetting(t.text)) return t.text.toLowerCase() as SettingName
      err(`${show(t)} is not a number or a setting.`)
      return null
    }

    switch (cmd) {
      case 'SET': {
        const [name, eq, val] = rest
        if (!name || name.kind !== 'word') return err('SET is missing the name of a setting.')
        if (!isSetting(name.text)) return err(`${name.text} is not a setting.`)
        if (!eq || eq.text !== '=') return err('SET needs an = between the setting and its value.')
        if (!val) return err(`SET ${name.text} = is missing a number.`)
        if (val.kind !== 'word' || !isNumber(val.text)) return err(`${show(val)} is not a number.`)
        if (extra(3)) return
        const key = name.text.toLowerCase() as SettingName
        const n = Number(val.text)
        const range = SETTING_RANGES[key]
        if (n < range.min || n > range.max) return err(`${key} must be between ${range.min} and ${range.max}.`)
        if (open) open.body.push({ op: 'set', name: key, value: n, line })
        else settings[key] = n
        return
      }
      case 'ON': {
        const [ev, colon] = rest
        if (open) {
          err(`ON starts a new block before the block on line ${open.line} is closed with END.`)
          close()
        }
        const name = ev?.kind === 'word' ? ev.text.toLowerCase() : ''
        const event: EventName | null = name === 'launch' || name === 'falling' ? name : null
        open = { event, line, body: [] }
        if (!ev || ev.kind !== 'word') return err('ON is missing an event name.')
        if (!event) return err(`${ev.text} is not an event.`)
        if (!colon || colon.text !== ':') return err(`ON ${ev.text} needs a : at the end.`)
        if (blocks[event]) {
          open.event = null
          return err(`There is already an ON ${event} block.`)
        }
        extra(2)
        return
      }
      case 'END': {
        if (!open) return err('END has no ON block to close.')
        extra(0)
        close()
        return
      }
      case 'IGNITE':
      case 'CUTOFF':
      case 'DEPLOY': {
        if (!needBlock()) return
        const target = cmd === 'DEPLOY' ? 'parachute' : 'engine'
        const [obj] = rest
        if (!obj) return err(`${cmd} is missing what it acts on.`)
        if (obj.kind !== 'word' || obj.text.toLowerCase() !== target) return err(`${show(obj)} is not something ${cmd} can act on.`)
        if (extra(1)) return
        open!.body.push({ op: cmd === 'IGNITE' ? 'ignite' : cmd === 'CUTOFF' ? 'cutoff' : 'deploy', line })
        return
      }
      case 'WAIT': {
        if (!needBlock()) return
        if (rest[0]?.kind === 'word' && rest[0].text.toUpperCase() === 'UNTIL') {
          const [, sensor, cmp, val] = rest
          if (!sensor) return err('WAIT UNTIL is missing a sensor.')
          if (sensor.kind !== 'word' || sensor.text.toLowerCase() !== 'altitude') return err(`${show(sensor)} is not a sensor.`)
          if (!cmp || (cmp.text !== '<' && cmp.text !== '>')) return err('WAIT UNTIL altitude needs a < or > before the value.')
          const v = value(val, 'WAIT UNTIL')
          if (v === null || extra(4)) return
          open!.body.push({ op: 'waitUntil', cmp: cmp.text as '<' | '>', value: v, line })
          return
        }
        const v = value(rest[0], 'WAIT')
        if (v === null || extra(1)) return
        open!.body.push({ op: 'wait', value: v, line })
        return
      }
      case 'LOG': {
        if (!needBlock()) return
        const [msg] = rest
        if (!msg) return err('LOG is missing its message.')
        if (msg.kind !== 'string') return err('LOG needs its message inside quotes.')
        if (extra(1)) return
        open!.body.push({ op: 'log', text: msg.text, line })
        return
      }
      case 'BEEP': {
        if (!needBlock() || extra(0)) return
        open!.body.push({ op: 'beep', line })
        return
      }
      default:
        err(`${first.text} is not a RocketScript command.`)
    }
  })

  const stillOpen = open as { event: EventName | null; line: number } | null
  if (stillOpen) errors.push({ line: stillOpen.line, message: `The ON block on line ${stillOpen.line} is never closed with END.` })
  if (errors.length) return { ok: false, program: null, errors }
  return { ok: true, program: { settings, blocks }, errors: [] }
}

// ---------------------------------------------------------------- starting program

interface TemplateLine {
  key: string
  text: string
}

function cleanTemplate(throttle: number, burn: number, deploy: number): TemplateLine[] {
  return [
    { key: 'c1', text: '// ==================================' },
    { key: 'c2', text: '//   Flight program for the rocket' },
    { key: 'c3', text: '// ==================================' },
    { key: 'b0', text: '' },
    { key: 'c4', text: '// --- Flight numbers: change these to change the flight ---' },
    { key: 'setThrottle', text: `SET throttle = ${throttle}         // engine power, 0-100 %` },
    { key: 'setBurn', text: `SET burn_time = ${burn}         // seconds before the engine shuts off` },
    { key: 'setDeploy', text: `SET deploy_altitude = ${deploy}   // open the parachute below this height (ft)` },
    { key: 'b1', text: '' },
    { key: 'onLaunch', text: 'ON launch:' },
    { key: 'log1', text: '    LOG "Countdown complete"' },
    { key: 'ignite', text: '    IGNITE engine' },
    { key: 'wait', text: '    WAIT burn_time' },
    { key: 'cutoff', text: '    CUTOFF engine' },
    { key: 'end1', text: 'END' },
    { key: 'b2', text: '' },
    { key: 'onFalling', text: 'ON falling:' },
    { key: 'waitUntil', text: '    WAIT UNTIL altitude < deploy_altitude' },
    { key: 'deploy', text: '    DEPLOY parachute' },
    { key: 'log2', text: '    LOG "Parachute out"' },
    { key: 'end2', text: 'END' },
  ]
}

/** Ways each line can arrive broken. `null` means the line is missing entirely. */
const BUGS: Record<string, ((t: string) => string | null)[]> = {
  setThrottle: [(t) => t.replace('SET', 'SETT'), (t) => t.replace('throttle =', 'throttle'), (t) => t.replace('throttle', 'throtle')],
  setBurn: [(t) => t.replace('burn_time', 'burn_tiem'), (t) => t.replace(/= [\d.]+/, (m) => `${m}s`)],
  setDeploy: [(t) => t.replace(/= (\d+)/, (_m, n: string) => `= ${n.replace(/0/g, 'O')}`), (t) => t.replace('deploy_altitude', 'deploy_altidude')],
  onLaunch: [(t) => t.replace(':', ''), (t) => t.replace('launch', 'lanch')],
  log1: [(t) => t.replace('complete"', 'complete'), (t) => t.replace('LOG', 'LGO')],
  ignite: [(t) => t.replace('IGNITE', 'IGNTIE'), (t) => t.replace('engine', 'engin')],
  wait: [(t) => t.replace('WAIT', 'WIAT'), (t) => t.replace('burn_time', 'burn_tme')],
  cutoff: [(t) => t.replace('CUTOFF', 'CUTOF'), (t) => t.replace('engine', 'engien')],
  end1: [() => null, () => 'ENDD'],
  onFalling: [(t) => t.replace('falling', 'faling'), (t) => t.replace(':', '')],
  waitUntil: [(t) => t.replace('UNTIL', 'UNTL'), (t) => t.replace('altitude <', 'altitud <')],
  deploy: [(t) => t.replace('DEPLOY', 'DELPOY'), (t) => t.replace('parachute', 'parashoot')],
  log2: [(t) => t.replace('"Parachute', 'Parachute')],
  end2: [() => 'ENDD', () => 'EDN'],
}

export const BUG_COUNT = 4

export interface StarterProgram {
  source: string
  /** The same program with no bugs (for tests and reference designs). */
  clean: string
  settings: { throttle: number; burn: number; deploy: number }
}

/** The team's starting program: sensible-ish numbers and a few typos and syntax slips, different per seed. */
export function starterProgram(seed: number): StarterProgram {
  const rand = mulberry32(seed ^ 0x5eed)
  const throttle = pick(rand, [55, 60, 65, 70])
  const burn = pick(rand, [2, 2.5, 3])
  const deploy = pick(rand, [800, 1000, 1200])
  const lines = cleanTemplate(throttle, burn, deploy)
  const buggy = new Set(shuffle(rand, Object.keys(BUGS)).slice(0, BUG_COUNT))
  const out: string[] = []
  for (const l of lines) {
    if (!buggy.has(l.key)) {
      out.push(l.text)
      continue
    }
    const broken = pick(rand, BUGS[l.key])(l.text)
    if (broken !== null) out.push(broken)
  }
  return {
    source: out.join('\n'),
    clean: lines.map((l) => l.text).join('\n'),
    settings: { throttle, burn, deploy },
  }
}

/** The program with its flight numbers replaced (used by reference designs). */
export function withSettings(source: string, s: Partial<Record<SettingName, number>>): string {
  return source
    .split('\n')
    .map((line) => {
      const m = /^SET (\w+) = [\d.]+/.exec(line)
      if (m && isSetting(m[1]) && s[m[1] as SettingName] !== undefined) {
        return line.replace(/= [\d.]+/, `= ${s[m[1] as SettingName]}`)
      }
      return line
    })
    .join('\n')
}
