"""Synthesizes the Reel's music bed and sound effects (no samples, so no licensing questions).

Usage: python audio.py <k> <out.wav>
k stretches every cue (and the tempo) to match reel.html's timeline when a voiceover sets the length.
Cue times below are the unstretched times from reel.html's render().
"""
import sys, wave
import numpy as np

K = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "sfx_music.wav"
SR = 44100
DUR = 24.5 * K
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))


def at(t):
    return int(t * K * SR)


def add(sig, t, gain=1.0, pan=0.0):
    """Places a mono signal at cue time t (unstretched seconds), equal-power pan -1..1."""
    i = at(t)
    sig = sig[: max(0, N - i)]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i : i + len(sig), 0] += sig * gain * l
    mix[i : i + len(sig), 1] += sig * gain * r


def tt(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be a per-sample array (for sweeps)."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y, acc = np.empty_like(x), 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def hp(x):
    return np.diff(x, prepend=0)


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------- instruments ----------
def kick():
    t = tt(0.45)
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + 0.3 * rng.standard_normal(len(t)) * np.exp(-t * 300)


def clap():
    t = tt(0.22)
    n = hp(rng.standard_normal(len(t)))
    env = np.exp(-t * 22) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0) * (t < 0.03))
    return 0.5 * n * env


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    return 0.35 * hp(hp(rng.standard_normal(len(t)))) * np.exp(-t * (12 if open_ else 70))


def bass(m, d):
    t = tt(d)
    f = note(m)
    s = sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 7))
    return 0.35 * s * np.minimum(1, t * 80) * np.exp(-t * 1.2) * np.minimum(1, (d - t) * 30)


def pad(ms, d):
    t = tt(d)
    s = np.zeros(len(t))
    for m in ms:
        for det in (-0.12, 0.0, 0.11):
            f = note(m + det)
            s += sum(np.sin(2 * np.pi * f * h * t + h) / (h * 1.6) for h in range(1, 5))
    return 0.05 * s * np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.5)


# ---------- sound effects ----------
def pop(f=700, d=0.12):
    t = tt(d)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t * 40))) / SR) * np.exp(-t * 38)


def tick(f=2400):
    t = tt(0.025)
    return 0.5 * np.sin(2 * np.pi * f * t) * np.exp(-t * 200)


def tap():
    t = tt(0.09)
    return 0.6 * rng.standard_normal(len(t)) * np.exp(-t * 600) + 0.7 * np.sin(2 * np.pi * 1250 * t) * np.exp(-t * 60)


def whoosh(d=0.45, up=True):
    t = tt(d)
    shape = np.sin(np.pi * t / d) ** 2
    cut = 300 + 5000 * (t / d if up else 1 - t / d)
    return 1.6 * lowpass(rng.standard_normal(len(t)), cut) * shape


def impact(d=1.2):
    t = tt(d)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 12)) / SR) * np.exp(-t * 3.2)
    return boom + 0.7 * lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 9)


def chime(m, d=0.9):
    t = tt(d)
    f = note(m)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 5) * 0.5


def stamp():
    t = tt(0.3)
    return np.sin(2 * np.pi * np.cumsum(70 + 80 * np.exp(-t * 40)) / SR) * np.exp(-t * 18) + 0.8 * hp(rng.standard_normal(len(t))) * np.exp(-t * 120)


def unlock():
    t = tt(0.06)
    click = 0.9 * hp(hp(rng.standard_normal(len(t)))) * np.exp(-t * 160)
    return np.concatenate([click, np.zeros(int(0.07 * SR)), click * 0.8])


def riser(d):
    t = tt(d)
    noise = lowpass(rng.standard_normal(len(t)), 200 + 7000 * (t / d) ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / d) ** 2) / SR)
    return (0.9 * noise + 0.15 * tone) * (t / d) ** 2


def shimmer(d):
    s = np.zeros(int(d * SR))
    for _ in range(28):
        b = chime(rng.choice([84, 86, 88, 91, 93, 96]), 0.35) * 0.25
        i = rng.integers(0, max(1, len(s) - len(b)))
        s[i : i + len(b)] += b
    return s


# ---------- music: 120 BPM (stretched by K), A minor  Am - F - C - G ----------
BEAT = 0.5
PROG = [(57, [69, 72, 76]), (53, [65, 69, 72]), (48, [64, 67, 72]), (55, [67, 71, 74])]
bar_len = 4 * BEAT
for b in range(int(24.5 / bar_len) + 1):
    start = b * bar_len
    root, chord = PROG[b % 4]
    if start < 22.6:
        add(pad(chord, bar_len * K + 0.4), start, 1.0)
    for q in range(4):
        tq = start + q * BEAT
        if tq >= 22.6:
            break
        groove = 3.4 <= tq and not (16.0 <= tq < 16.5)  # half-second drop right before the price lands
        if tq >= 0.0 and (groove or (tq < 3.4 and q == 0)):
            add(kick(), tq, 0.9)
        if groove:
            if q in (1, 3):
                add(clap(), tq, 0.55)
            add(hat(), tq + BEAT / 2, 0.5, 0.3)
            add(hat(), tq, 0.3, -0.3)
            add(bass(root - 12, BEAT * K * 0.9), tq, 0.75)
        elif tq < 3.4:
            add(hat(), tq + BEAT / 2, 0.35, 0.2)
add(pad([57, 64, 69, 72, 76], 2.6 * K), 22.6, 1.3)  # final chord under the end card

# ---------- sound effects on the animation cues ----------
add(impact(), 0.0, 0.9)
for i, c in enumerate([0.15, 0.5, 0.95, 1.3]):
    add(pop(600 + i * 90), c, 0.55, 0.2 * (i % 2 * 2 - 1))
add(whoosh(0.35), 0.95, 0.5, -0.6)
add(whoosh(0.35), 2.05, 0.5, 0.6)
add(whoosh(0.45, up=False), 2.95, 0.7)
add(pop(520), 3.5, 0.5)
add(whoosh(0.4), 3.55, 0.45, 0.4)
for i in range(4):
    add(tick(1800 + i * 150), 3.85 + i * 0.12, 0.6)
for c in (4.55, 5.05):
    add(tap(), c, 0.8)
    add(chime(84, 0.4), c + 0.02, 0.35)
add(whoosh(0.4), 5.55, 0.6, -0.5)
for i, c in enumerate(np.arange(5.9, 6.85, 0.07)):
    add(tick(1500 + i * 70), c, 0.35, 0.3)
for i in range(11):
    add(chime([69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93][i], 0.5), 6.5 + i * 0.07, 0.3, -0.5 + i * 0.1)
add(impact(0.9), 8.7, 0.6)
add(pop(380, 0.2), 8.75, 0.6)
add(shimmer(1.3), 8.85, 0.5)
for i, c in enumerate(np.arange(10.8, 12.0, 0.06)):
    add(tick(2600 - i * 55), c, 0.3, -0.2)
for i in range(5):
    add(chime([76, 79, 81, 84, 88][i], 0.7), 11.0 + i * 0.06, 0.4, -0.6 + i * 0.3)
add(whoosh(0.4, up=False), 12.1, 0.5)
for i in range(5):
    add(whoosh(0.25), 12.45 + i * 0.22, 0.35, 0.5 - i * 0.25)
add(riser(1.0), 13.4, 0.18)
for c in (14.35, 14.65):  # "חינם" stamps on places 5 and 4
    add(stamp(), c, 0.8)
add(whoosh(0.5, up=False), 15.95, 0.7)
add(impact(1.1), 16.55, 0.85)
add(chime(88, 0.8), 16.65, 0.5, -0.3)
add(chime(93, 0.9), 16.75, 0.5, 0.3)
for c in (19.0, 19.15, 19.3):  # three locks open
    add(unlock(), c, 0.8)
add(shimmer(0.9), 19.05, 0.55)
add(riser(0.5), 20.3, 0.5)
for i in range(3):
    add(stamp(), 21.25 + i * 0.14, 0.6)
add(impact(1.6), 20.9, 0.7)
add(whoosh(0.4), 21.4, 0.4)
for i, c in enumerate((21.9, 22.1, 22.35)):
    add(pop(560 + i * 120), c, 0.5)
add(impact(1.8), 22.6, 0.8)
add(chime(81, 1.2), 22.62, 0.4)

# ---------- master: soft clip, normalise, fade out ----------
mix = mix[: int(DUR * SR)]
mix = np.tanh(mix * 0.9)
mix /= np.max(np.abs(mix)) / 0.89
fade = int(0.8 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"{OUT}: {DUR:.1f}s")
