/* Sound effects. */

/* Sound: one audio context, unlocked by the first tap (iOS only plays audio started from a gesture) */
let audioCtx = null;

function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const silent = audioCtx.createBufferSource();
      silent.buffer = audioCtx.createBuffer(1, 1, 22050);
      silent.connect(audioCtx.destination);
      silent.start(0);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

document.addEventListener('pointerdown', unlockAudio, { passive: true });

function tone(freq, startIn, duration, volume) {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime + startIn;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  } catch (e) {}
}

function playTick() {
  tone(1046.5, 0, 0.08, 0.12);
}

function playChime() {
  tone(880, 0, 0.45, 0.3);
  tone(1318.5, 0.16, 0.7, 0.3);
}
