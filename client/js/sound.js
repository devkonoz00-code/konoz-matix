/**
 * MATIX Sound Effects Engine (Web Audio API)
 * Maximum Output Volume with Multi-Harmonic Synthesis & Master Limiter
 */

let audioCtx = null;
let masterGain = null;
let masterCompressor = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();

      // Fast Limiter / Compressor to allow maximum loudness without digital clipping
      masterCompressor = audioCtx.createDynamicsCompressor();
      masterCompressor.threshold.setValueAtTime(-2, audioCtx.currentTime);
      masterCompressor.knee.setValueAtTime(6, audioCtx.currentTime);
      masterCompressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      masterCompressor.attack.setValueAtTime(0.001, audioCtx.currentTime);
      masterCompressor.release.setValueAtTime(0.08, audioCtx.currentTime);

      // Master Output Gain Booster (Max Clean Volume)
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(1.6, audioCtx.currentTime);

      masterCompressor.connect(masterGain);
      masterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Unlock audio on first user touch / click
['click', 'touchstart', 'keydown'].forEach(event => {
  window.addEventListener(event, () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }, { once: true, passive: true });
});

/**
 * 1. Success Chime — Maximum Volume 4-note Chord Arpeggio (C5 -> E5 -> G5 -> C6)
 * High energy with rich upper harmonics for maximum audibility on all speakers.
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.30 }, // C5
      { freq: 659.25, time: 0.09, dur: 0.30 }, // E5
      { freq: 783.99, time: 0.18, dur: 0.38 }, // G5
      { freq: 1046.50, time: 0.27, dur: 0.45 }, // C6
    ];

    const startTime = ctx.currentTime;

    notes.forEach(note => {
      // Voice 1: Triangle fundamental
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(note.freq, startTime + note.time);

      // Voice 2: Sine upper overtone
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(note.freq * 2, startTime + note.time);

      // Voice 3: Square wave for high acoustic energy
      const osc3 = ctx.createOscillator();
      osc3.type = 'square';
      osc3.frequency.setValueAtTime(note.freq, startTime + note.time);

      const voiceGain = ctx.createGain();
      const voice3Gain = ctx.createGain();
      voice3Gain.gain.setValueAtTime(0.25, startTime + note.time);

      osc3.connect(voice3Gain);
      voice3Gain.connect(voiceGain);
      osc1.connect(voiceGain);
      osc2.connect(voiceGain);

      voiceGain.gain.setValueAtTime(0.01, startTime + note.time);
      voiceGain.gain.exponentialRampToValueAtTime(0.95, startTime + note.time + 0.015);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.time + note.dur);

      if (masterCompressor) {
        voiceGain.connect(masterCompressor);
      } else {
        voiceGain.connect(ctx.destination);
      }

      osc1.start(startTime + note.time);
      osc2.start(startTime + note.time);
      osc3.start(startTime + note.time);

      osc1.stop(startTime + note.time + note.dur + 0.05);
      osc2.stop(startTime + note.time + note.dur + 0.05);
      osc3.stop(startTime + note.time + note.dur + 0.05);
    });
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

/**
 * 2. Confirm Beep — Loud, High-Energy Dual Beep (E5 -> C6 -> E6)
 * High-cut acoustic punch for instant button and scanner feedback.
 */
export function playConfirmBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(783.99, startTime); // G5
    osc1.frequency.exponentialRampToValueAtTime(1174.66, startTime + 0.07); // D6

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1567.98, startTime); // G6 harmonic

    osc3.type = 'square';
    osc3.frequency.setValueAtTime(783.99, startTime);
    const osc3Gain = ctx.createGain();
    osc3Gain.gain.setValueAtTime(0.20, startTime);
    osc3.connect(osc3Gain);
    osc3Gain.connect(gain);

    osc1.connect(gain);
    osc2.connect(gain);

    gain.gain.setValueAtTime(0.01, startTime);
    gain.gain.exponentialRampToValueAtTime(1.0, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

    if (masterCompressor) {
      gain.connect(masterCompressor);
    } else {
      gain.connect(ctx.destination);
    }

    osc1.start(startTime);
    osc2.start(startTime);
    osc3.start(startTime);

    osc1.stop(startTime + 0.24);
    osc2.stop(startTime + 0.24);
    osc3.stop(startTime + 0.24);
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

/**
 * 3. Error Alert — Maximum Volume Double Buzzer (280 Hz -> 200 Hz)
 * Distinct warning buzzer that cuts through loudly.
 */
export function playErrorTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    const pulses = [
      { freq: 280.00, offset: 0.00 },
      { freq: 200.00, offset: 0.13 },
    ];

    pulses.forEach(pulse => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(pulse.freq, startTime + pulse.offset);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(pulse.freq * 1.5, startTime + pulse.offset);

      gain.gain.setValueAtTime(0.01, startTime + pulse.offset);
      gain.gain.exponentialRampToValueAtTime(0.95, startTime + pulse.offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + pulse.offset + 0.15);

      osc1.connect(gain);
      osc2.connect(gain);

      if (masterCompressor) {
        gain.connect(masterCompressor);
      } else {
        gain.connect(ctx.destination);
      }

      osc1.start(startTime + pulse.offset);
      osc2.start(startTime + pulse.offset);

      osc1.stop(startTime + pulse.offset + 0.17);
      osc2.stop(startTime + pulse.offset + 0.17);
    });
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

/**
 * Master sound trigger based on action type:
 * - 'success' -> playSuccessChime()
 * - 'confirm' -> playConfirmBeep()
 * - 'error'   -> playErrorTone()
 */
export function playSound(type) {
  if (type === 'success') {
    playSuccessChime();
  } else if (type === 'confirm' || type === 'confirm2') {
    playConfirmBeep();
  } else if (type === 'error' || type === 'warning') {
    playErrorTone();
  }
}
