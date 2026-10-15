# Makes the rest-timer sounds (the web app's tick and chime, js/sound.js) as WAV files:
# sine tones with a 12 ms fade in and an exponential fade out.
#   python3 scripts/make-sounds.py
import math, os, struct, wave

RATE = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')

def tone(samples, freq, start, dur, vol):
    s0 = int(start * RATE)
    for i in range(int(dur * RATE)):
        t = i / RATE
        env = vol * t / 0.012 if t < 0.012 else vol * (0.0001 / vol) ** ((t - 0.012) / (dur - 0.012))
        if s0 + i < len(samples):
            samples[s0 + i] += math.sin(2 * math.pi * freq * t) * env

def save(name, length, tones):
    samples = [0.0] * int(RATE * length)
    for t in tones:
        tone(samples, *t)
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x)) * 32767)) for x in samples))

os.makedirs(OUT, exist_ok=True)
save('tick', 0.12, [(1046.5, 0, 0.08, 0.12)])
save('chime', 0.9, [(880, 0, 0.45, 0.3), (1318.5, 0.16, 0.7, 0.3)])
