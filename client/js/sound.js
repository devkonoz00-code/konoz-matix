/**
 * MATIX Sound Effects Engine (Web Audio API)
 * Enhanced High-Volume, Zero-Latency Synthesized Audio Feedback
 * Includes Dynamics Compressor for maximum loudness without distortion.
 */

let audioCtx = null;
let masterCompressor = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      
      // Master Compressor for maximum punch and loudness without digital clipping
      masterCompressor = audioCtx.createDynamicsCompressor();
      masterCompressor.threshold.setValueAtTime(-6, audioCtx.currentTime);
      masterCompressor.knee.setValueAtTime(12, audioCtx.currentTime);
      masterCompressor.ratio.setValueAtTime(4, audioCtx.currentTime);
      masterCompressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      masterCompressor.release.setValueAtTime(0.15, audioCtx.currentTime);
      masterCompressor.connect(audioCtx.destination);
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
 * 1. Success Chime — Loud, bright 3-note harmonic arpeggio (C5 -> E5 -> G5 -> C6)
 * Used when operations complete successfully.
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.28 }, // C5
      { freq: 659.25, time: 0.08, dur: 0.28 }, // E5
      { freq: 783.99, time: 0.16, dur: 0.35 }, // G5
      { freq: 1046.50, time: 0.24, dur: 0.40 }, // C6 (High sparkle)
    ];

    const startTime = ctx.currentTime;

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      // Fundamental sine + soft triangle for warmth and loudness
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, startTime + note.time);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(note.freq, startTime + note.time);

      gain.gain.setValueAtTime(0.001, startTime + note.time);
      gain.gain.exponentialRampToValueAtTime(0.65, startTime + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.time + note.dur);

      osc.connect(gain);
      osc2.connect(gain);

      if (masterCompressor) {
        gain.connect(masterCompressor);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(startTime + note.time);
      osc2.start(startTime + note.time);
      osc.stop(startTime + note.time + note.dur + 0.05);
      osc2.stop(startTime + note.time + note.dur + 0.05);
    });
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

/**
 * 2. Confirm Beep — Loud, crisp dual-tone pop (D5 -> A5)
 * Used on action button clicks, modal confirmations, and barcode scanner hits.
 */
export function playConfirmBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, startTime); // E5
    osc.frequency.exponentialRampToValueAtTime(1046.50, startTime + 0.08); // C6

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, startTime); // E6 harmonic

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.70, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.20);

    osc.connect(gain);
    osc2.connect(gain);

    if (masterCompressor) {
      gain.connect(masterCompressor);
    } else {
      gain.connect(ctx.destination);
    }

    osc.start(startTime);
    osc2.start(startTime);
    osc.stop(startTime + 0.22);
    osc2.stop(startTime + 0.22);
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

/**
 * 3. Error Alert — Loud, punchy dual-pulse warning buzz (240 Hz -> 180 Hz)
 * Used when an error, validation failure, or rejection occurs.
 */
export function playErrorTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    const pulses = [
      { freq: 240.00, offset: 0.00 },
      { freq: 180.00, offset: 0.12 },
    ];

    pulses.forEach(pulse => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pulse.freq, startTime + pulse.offset);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(pulse.freq * 0.5, startTime + pulse.offset); // Sub-bass punch

      gain.gain.setValueAtTime(0.001, startTime + pulse.offset);
      gain.gain.exponentialRampToValueAtTime(0.65, startTime + pulse.offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + pulse.offset + 0.14);

      osc.connect(gain);
      osc2.connect(gain);

      if (masterCompressor) {
        gain.connect(masterCompressor);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(startTime + pulse.offset);
      osc2.start(startTime + pulse.offset);
      osc.stop(startTime + pulse.offset + 0.16);
      osc2.stop(startTime + pulse.offset + 0.16);
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
