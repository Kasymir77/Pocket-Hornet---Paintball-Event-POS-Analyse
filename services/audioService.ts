
/**
 * Imperial Audio Service v2.0
 * Advanced Subtractive Synthesis für realistische Paintball-Akustik.
 * Offline-Core. Keine externen Files. Pure Mathematik.
 */

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private init() {
    if (!this.ctx) {
      // @ts-ignore
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx!.createGain();
      this.masterGain.gain.value = 0.8; // Master Volume
      this.masterGain.connect(this.ctx!.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Hilfsfunktion: Rausch-Generator (Buffer)
  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) this.init();
    const bufferSize = this.ctx!.sampleRate * 2.0; // 2 Sekunden Noise
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * SOUND: MODERN UI TICK
   * Leises, taktisches Klicken für Navigation.
   */
  playClick() {
    this.init();
    const t = this.ctx!.currentTime;
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    // Kurzer, hoher Impuls (Transiente)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * SOUND: MARKIERER SCHUSS (Pneumatisch)
   * Simuliert Gas-Expansion (Noise) + Bolt Schlag (Low Kick).
   * Einsatz: Artikel in Warenkorb.
   */
  playShot() {
    this.init();
    const t = this.ctx!.currentTime;

    // 1. GAS EXPANSION (Noise durch LowPass Filter)
    const noise = this.ctx!.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const noiseFilter = this.ctx!.createBiquadFilter();
    const noiseGain = this.ctx!.createGain();

    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1500, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.1); // "Pfft" Sound
    noiseFilter.Q.value = 1;

    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08); // Sehr kurz

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(t);
    noise.stop(t + 0.1);

    // 2. BOLT KICK (Mechanischer Schlag)
    const kick = this.ctx!.createOscillator();
    const kickGain = this.ctx!.createGain();
    
    kick.frequency.setValueAtTime(150, t);
    kick.frequency.exponentialRampToValueAtTime(50, t + 0.05);
    
    kickGain.gain.setValueAtTime(0.5, t);
    kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    kick.connect(kickGain);
    kickGain.connect(this.masterGain!);
    kick.start(t);
    kick.stop(t + 0.05);
  }

  /**
   * SOUND: BUNKER HIT / SPLAT
   * Dumpfer Aufprall + hohes Platschen.
   * Einsatz: Checkout / Bezahlung erfolgreich.
   */
  playSplat() {
    this.init();
    const t = this.ctx!.currentTime;

    // 1. IMPACT (Tiefer Thud)
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2); // Pitch Drop
    
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.2);

    // 2. SPLATTER (Matschiges Rauschen)
    const noise = this.ctx!.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const noiseFilter = this.ctx!.createBiquadFilter();
    const noiseGain = this.ctx!.createGain();

    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, t); // Mitten-betont für "Klatsch"
    noiseFilter.Q.value = 0.5;

    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(t);
    noise.stop(t + 0.2);
  }

  /**
   * SOUND: RELOAD / MECHANIK
   * Mechanisches Ratschen / Slide.
   * Einsatz: Löschen / Reset / Storno.
   */
  playReload() {
    this.init();
    const t = this.ctx!.currentTime;

    // Metallisches Ratschen
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.15); // Slide Down

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /**
   * SOUND: ERROR / JAM
   * Markierer Jam Sound (Dumpfes Klicken).
   */
  playError() {
    this.init();
    const t = this.ctx!.currentTime;

    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * SOUND: SUCCESS CHIME
   * Modernes, weiches "Ding".
   */
  playDing() {
    this.init();
    const t = this.ctx!.currentTime;

    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); // A5
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.5);
    
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0); // Langer Ausklang

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.0);
  }

  // Wrapper für Kompatibilität, falls nötig
  playRemove() { this.playReload(); }
  playKaching() { this.playSplat(); }
  playRevert() { this.playReload(); }
}

export const soundService = new AudioService();
