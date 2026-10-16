// Procedural Web Audio API sound engine for BATTLEBOT INCUBATOR
class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
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
    gain.connect(ctx.destination);
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
    servoGain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
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
    gain.connect(ctx.destination);
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
    ringGain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.46);
    });
  }
}

export const soundEngine = new SoundEngine();
