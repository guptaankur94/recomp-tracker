// Rest timer sounds: a soft tick for the last three seconds and a chime when rest ends (as in the web app).
// They play alongside music instead of pausing it, and follow the phone's silent switch.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = { tick: require('@/assets/sounds/tick.wav'), chime: require('@/assets/sounds/chime.wav') };

let players: Record<keyof typeof SOURCES, AudioPlayer> | null = null;

function ready() {
  if (!players) {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    players = { tick: createAudioPlayer(SOURCES.tick), chime: createAudioPlayer(SOURCES.chime) };
  }
  return players;
}

export function playSound(name: keyof typeof SOURCES) {
  try {
    const p = ready()[name];
    p.seekTo(0);
    p.play();
  } catch {
    // Sound is a nicety; the timer works without it
  }
}
