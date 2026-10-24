"""Music bed + sound effects for an engine.html reel, synthesized (no samples, no licensing questions).
Usage: python music.py <cues.json> <out.wav>   cues.json = {"dur": seconds, "cues": [[t, kind], ...]} from record.mjs
Reuses the instruments in ../ig-launch/reel/audio.py.
"""
import sys, json, wave, pathlib
import numpy as np

spec = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
OUT = sys.argv[2]

# ponytail: execs audio.py's instrument/effect definitions (everything before its music section); breaks if audio.py is restructured
src = (pathlib.Path(__file__).resolve().parent.parent / "ig-launch" / "reel" / "audio.py").read_text(encoding="utf-8")
ns = {"__name__": "instruments"}
sys_argv, sys.argv = sys.argv, ["audio.py", "1", "unused.wav"]
exec(src[: src.index("# ---------- music")], ns)
sys.argv = sys_argv

SR, DUR = ns["SR"], float(spec["dur"])
ns["N"] = N = int(DUR * SR) + SR
ns["mix"] = np.zeros((N, 2))
add, pad, kick, clap, hat, bass = ns["add"], ns["pad"], ns["kick"], ns["clap"], ns["hat"], ns["bass"]
pop, tick, whoosh, impact, chime, stamp, riser, shimmer = (ns[k] for k in ("pop", "tick", "whoosh", "impact", "chime", "stamp", "riser", "shimmer"))

# ---------- music: 120 BPM, A minor Am - F - C - G; light intro, groove after the hook ----------
BEAT = 0.5
PROG = [(57, [69, 72, 76]), (53, [65, 69, 72]), (48, [64, 67, 72]), (55, [67, 71, 74])]
GROOVE = float(spec.get("groove", 0))  # the beat starts here (0 = from the first frame)
END = DUR - 2.4
for b in range(0 if spec.get("sfx_only") else int(DUR / (4 * BEAT)) + 1):  # sfx_only: ElevenLabs music replaces the synth bed
    start = b * 4 * BEAT
    root, chord = PROG[b % 4]
    if start < END:
        add(pad(chord, 4 * BEAT + 0.4), start, 1.0)
    for q in range(4):
        tq = start + q * BEAT
        if tq >= END:
            break
        groove = tq >= GROOVE
        if groove or q == 0:
            add(kick(), tq, 0.85)
        if groove:
            if q in (1, 3):
                add(clap(), tq, 0.5)
            add(hat(), tq + BEAT / 2, 0.45, 0.3)
            add(hat(), tq, 0.28, -0.3)
            add(bass(root - 12, BEAT * 0.9), tq, 0.7)
        else:
            add(hat(), tq + BEAT / 2, 0.3, 0.2)
if not spec.get("sfx_only"):
    add(pad([57, 64, 69, 72, 76], 2.6), END, 1.3)
add(impact(1.2), 0.0, 0.7)  # the first frame hits

# ---------- effects on the animation cues ----------
rng = np.random.default_rng(3)
for i, (t, kind) in enumerate(spec["cues"]):
    p = float(rng.uniform(-0.5, 0.5))
    if kind == "pop":
        add(pop(560 + (i % 5) * 80), t, 0.5, p)
    elif kind == "whoosh":
        add(whoosh(0.4), max(0, t - 0.15), 0.45, p)
    elif kind == "tick":
        add(tick(1900 + (i % 4) * 140), t, 0.6, p)
    elif kind == "stamp":
        add(stamp(), t, 0.85)
    elif kind == "chime":
        add(chime(84, 0.6), t, 0.4, p)
        add(chime(88, 0.6), t + 0.07, 0.3, -p)
    elif kind == "riser":
        add(riser(0.5), t, 0.35)
    elif kind == "reveal":
        add(impact(0.9), t, 0.6)
        add(chime(88, 0.8), t + 0.02, 0.45, -0.3)
        add(chime(93, 0.9), t + 0.1, 0.45, 0.3)
    elif kind == "count":
        for j, c in enumerate(np.arange(t, t + 1.0, 0.07)):
            add(tick(1500 + j * 70), c, 0.3, 0.3)
    elif kind == "cut":
        add(whoosh(0.25, up=False), max(0, t - 0.12), 0.35, p)
    elif kind == "slam":
        add(impact(0.6), t, 0.45)
        add(pop(300, 0.15), t, 0.4)
    elif kind == "impact":
        add(impact(1.4), t, 0.75)
        add(shimmer(1.0), t + 0.1, 0.4)

# ---------- master ----------
mix = ns["mix"][: int(DUR * SR)]
mix = np.tanh(mix * 0.9)
mix /= np.max(np.abs(mix)) / 0.89
fade = int(0.8 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
