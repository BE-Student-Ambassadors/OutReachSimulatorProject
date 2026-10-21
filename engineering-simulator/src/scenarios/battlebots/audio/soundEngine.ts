// Procedural Web Audio API sound engine for BATTLEBOT INCUBATOR
import { audioOut, isMuted, toggleMuted } from '../../../shared/audio/sfx';

// Routed through the shared audio output, so the one mute switch covers these sounds too.
class SoundEngine {
  private out: AudioNode | null = null;

  public get muted(): boolean {
    return isMuted();
  }

  private getContext(): AudioContext | null {
    if (isMuted()) return null;
    const a = audioOut();
    if (!a) return null;
    this.out = a.out;
    return a.ctx;
  }

  public toggleMute(): boolean {
    toggleMuted();
    return isMuted();
  }

  public playInstall(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.out!);
    osc.start(now);
    osc.stop(now + 0.11);

    const servo = ctx.createOscillator();
    const servoGain = ctx.createGain();
    servo.type = 'sine';
    servo.frequency.setValueAtTime(520, now + 0.07);
    servo.frequency.exponentialRampToValueAtTime(880, now + 0.17);
    servoGain.gain.setValueAtTime(0.001, now);
    servoGain.gain.setValueAtTime(0.12, now + 0.07);
    servoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    servo.connect(servoGain);
    servoGain.connect(this.out!);
    servo.start(now + 0.07);
    servo.stop(now + 0.2);
  }

  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.out!);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playWarning(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.setValueAtTime(190, now + 0.1);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.out!);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playSpinUp(durationSec = 1.2): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + durationSec);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.14, now + durationSec * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(this.out!);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playCombatImpact(severity: 'tiny' | 'normal' | 'heavy' | 'major', type: 'chassis' | 'weapon' | 'wall' = 'chassis'): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (severity === 'tiny') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);
      return;
    }
    const isMajor = severity === 'major';
    const isHeavy = severity === 'heavy';
    const dur = isMajor ? 0.34 : isHeavy ? 0.24 : 0.14;
    const vol = isMajor ? 0.38 : isHeavy ? 0.26 : 0.14;

    // 1. Low physical impact thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    const startFreq = type === 'wall' ? 130 : isMajor ? 210 : isHeavy ? 175 : 150;
    const endFreq = type === 'wall' ? 32 : 35;
    thump.frequency.setValueAtTime(startFreq, now);
    thump.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    thumpGain.gain.setValueAtTime(vol, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + dur + 0.02);

    // 2. Metallic whack resonance
    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = type === 'weapon' ? 'sawtooth' : 'square';
    const ringFreq = type === 'wall' ? 640 : type === 'weapon' ? (isMajor ? 1480 : 1240) : (isMajor ? 1120 : 960);
    ring.frequency.setValueAtTime(ringFreq, now);
    ring.frequency.exponentialRampToValueAtTime(260, now + dur * 0.75);
    ringGain.gain.setValueAtTime(vol * (type === 'weapon' ? 0.45 : 0.28), now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.75);
    ring.connect(ringGain);
    ringGain.connect(ctx.destination);
    ring.start(now);
    ring.stop(now + dur * 0.8);

    // 3. Sharp high-frequency transient crack for weapon or heavy impacts
    if (isHeavy || isMajor || type === 'weapon') {
      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = 'square';
      snap.frequency.setValueAtTime(isMajor ? 2800 : 2100, now);
      snap.frequency.exponentialRampToValueAtTime(450, now + 0.05);
      snapGain.gain.setValueAtTime(vol * 0.32, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      snap.connect(snapGain);
      snapGain.connect(ctx.destination);
      snap.start(now);
      snap.stop(now + 0.055);
    }
  }

  public playImpact(intensity: 'light' | 'medium' | 'heavy' = 'medium'): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = intensity === 'heavy' ? 0.28 : intensity === 'medium' ? 0.18 : 0.1;
    const dur = intensity === 'heavy' ? 0.26 : 0.15;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(intensity === 'heavy' ? 145 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.out!);
    osc.start(now);
    osc.stop(now + dur + 0.02);

    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = 'square';
    ring.frequency.setValueAtTime(intensity === 'heavy' ? 920 : 1140, now);
    ring.frequency.exponentialRampToValueAtTime(310, now + dur * 0.8);
    ringGain.gain.setValueAtTime(vol * 0.35, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.8);
    ring.connect(ringGain);
    ringGain.connect(this.out!);
    ring.start(now);
    ring.stop(now + dur);
  }

  public playArenaHorn(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [220, 277.18, 329.63].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain);
      gain.connect(this.out!);
      osc.start(now);
      osc.stop(now + 0.56);
    });
  }

  public playBattleEnd(victory: boolean): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = victory ? [261.63, 329.63, 392.0, 523.25] : [220, 196, 164.81];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain);
      gain.connect(this.out!);
      osc.start(start);
      osc.stop(start + 0.46);
    });
  }

  /**
   * Arcade-style critical alert: rapid pulsing tone with rising harmonics
   * announcing that the boss is in a critical finish state.
   */
  public playCriticalAlert(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.12, 0.24].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(740, now + offset);
      osc.frequency.exponentialRampToValueAtTime(880, now + offset + 0.07);
      gain.gain.setValueAtTime(0.14, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(this.out!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  /**
   * Heavy cinematic final knockout impact sound:
   * 1. Sub-bass shockwave boom
   * 2. Metallic structure collapse
   * 3. Electrical short-circuit blowout transient
   */
  public playFinalHit(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Deep sub-bass impact boom
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.65);
    subGain.gain.setValueAtTime(0.48, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    sub.connect(subGain);
    subGain.connect(this.out!);
    sub.start(now);
    sub.stop(now + 0.7);

    // 2. Heavy crunch & metallic resonance
    const crunch = ctx.createOscillator();
    const crunchGain = ctx.createGain();
    crunch.type = 'sawtooth';
    crunch.frequency.setValueAtTime(540, now);
    crunch.frequency.exponentialRampToValueAtTime(80, now + 0.38);
    crunchGain.gain.setValueAtTime(0.36, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    crunch.connect(crunchGain);
    crunchGain.connect(this.out!);
    crunch.start(now);
    crunch.stop(now + 0.42);

    // 3. Electrical circuit burnout crack
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'square';
    snap.frequency.setValueAtTime(2600, now);
    snap.frequency.exponentialRampToValueAtTime(160, now + 0.16);
    snapGain.gain.setValueAtTime(0.26, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    snap.connect(snapGain);
    snapGain.connect(this.out!);
    snap.start(now);
    snap.stop(now + 0.18);
  }
}

export const soundEngine = new SoundEngine();
