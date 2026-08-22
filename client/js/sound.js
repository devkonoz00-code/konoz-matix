/**
 * MATIX Sound Effects Engine (Web Audio API)
 * Provides zero-dependency, lightweight synthesized audio feedback:
 * 1. Success Chime (3-note pleasant upward arpeggio for completed operations)
 * 2. Confirm Beep (Fast modern dual-tone blip for instant confirmations/scans)
 * 3. Error Alert (Distinct low-frequency warning tone for errors and rejections)
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
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
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }, { once: true, passive: true });
});

/**
 * 1. Success Chime — Uplifting 3-note harmonic arpeggio (C5 -> E5 -> G5)
 * Used when operations complete successfully (e.g. item created, stock received, transfer completed).
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const startTime = ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + index * 0.07);

      gain.gain.setValueAtTime(0.001, startTime + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + index * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index * 0.07 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + index * 0.07);
      osc.stop(startTime + index * 0.07 + 0.25);
    });
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

/**
 * 2. Confirm Beep — Fast modern dual-tone pop (D5 -> A5)
 * Used on action button clicks, modal confirmations, and barcode scanner hits.
 */
export function playConfirmBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;

    // Primary tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, startTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.00, startTime + 0.08); // A5

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.18);
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

/**
 * 3. Error Alert — Low dual-pulse warning tone (220 Hz -> 174.61 Hz)
 * Used when an error, validation failure, or rejection occurs.
 */
export function playErrorTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    const pulses = [
      { freq: 220.00, offset: 0 },    // A3
      { freq: 174.61, offset: 0.11 }, // F3
    ];

    pulses.forEach(pulse => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pulse.freq, startTime + pulse.offset);

      gain.gain.setValueAtTime(0.001, startTime + pulse.offset);
      gain.gain.exponentialRampToValueAtTime(0.16, startTime + pulse.offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + pulse.offset + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + pulse.offset);
      osc.stop(startTime + pulse.offset + 0.14);
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
