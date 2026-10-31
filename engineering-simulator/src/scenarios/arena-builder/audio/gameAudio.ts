import type { CombatSoundEvent } from '../simulation/combatEngine'

class GameAudioEngine {
  private ctx: AudioContext | null = null
  private muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem('besa-sound-muted') === '1'
    } catch {
      this.muted = false
    }
  }

  private initCtx(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    } catch {
      // AudioContext not available in some environments
    }
    return this.ctx
  }

  setMuted(m: boolean) {
    this.muted = m
  }

  isMuted() {
    return this.muted
  }

  play(event: CombatSoundEvent['type']) {
    if (this.muted) return
    const ctx = this.initCtx()
    if (!ctx) return

    // Resume if suspended
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const t = ctx.currentTime

    switch (event) {
      case 'slash': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(450, t)
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.12)
        gain.gain.setValueAtTime(0.18, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.12)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.12)
        break
      }

      case 'blast': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(780, t)
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.1)
        gain.gain.setValueAtTime(0.12, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.1)
        break
      }

      case 'hammer':
      case 'boss_slam': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(160, t)
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.3)
        gain.gain.setValueAtTime(0.35, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.35)
        break
      }

      case 'boss_windup': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(180, t)
        osc.frequency.linearRampToValueAtTime(380, t + 0.4)
        gain.gain.setValueAtTime(0.02, t)
        gain.gain.linearRampToValueAtTime(0.15, t + 0.38)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.42)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.42)
        break
      }

      case 'boss_cleave': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(320, t)
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.22)
        gain.gain.setValueAtTime(0.28, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.22)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.22)
        break
      }

      case 'boss_fireball': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(520, t)
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.18)
        gain.gain.setValueAtTime(0.2, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.18)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.18)
        break
      }

      case 'hit_player': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(140, t)
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15)
        gain.gain.setValueAtTime(0.25, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.15)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.15)
        break
      }

      case 'hit_boss': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(380, t)
        osc.frequency.exponentialRampToValueAtTime(240, t + 0.08)
        gain.gain.setValueAtTime(0.2, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.08)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.08)
        break
      }

      case 'dash': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(320, t)
        osc.frequency.linearRampToValueAtTime(640, t + 0.08)
        osc.frequency.linearRampToValueAtTime(200, t + 0.18)
        gain.gain.setValueAtTime(0.2, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.18)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.18)
        break
      }

      case 'shield': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(220, t)
        osc.frequency.linearRampToValueAtTime(440, t + 0.2)
        gain.gain.setValueAtTime(0.2, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.25)
        break
      }

      case 'heal': {
        ;[440, 554, 659, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, t + idx * 0.06)
          gain.gain.setValueAtTime(0.12, t + idx * 0.06)
          gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.06 + 0.12)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(t + idx * 0.06)
          osc.stop(t + idx * 0.06 + 0.12)
        })
        break
      }

      case 'hazard': {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(90, t)
        gain.gain.setValueAtTime(0.08, t)
        gain.gain.linearRampToValueAtTime(0.01, t + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.1)
        break
      }

      case 'victory': {
        ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(freq, t + idx * 0.12)
          gain.gain.setValueAtTime(0.25, t + idx * 0.12)
          gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.12 + 0.3)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(t + idx * 0.12)
          osc.stop(t + idx * 0.12 + 0.3)
        })
        break
      }

      case 'defeat': {
        ;[440, 415.3, 392, 349.2].forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sawtooth'
          osc.frequency.setValueAtTime(freq, t + idx * 0.15)
          gain.gain.setValueAtTime(0.2, t + idx * 0.15)
          gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.15 + 0.25)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(t + idx * 0.15)
          osc.stop(t + idx * 0.15 + 0.25)
        })
        break
      }
    }
  }
}

export const gameAudio = new GameAudioEngine()
