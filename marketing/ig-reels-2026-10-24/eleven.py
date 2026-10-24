"""ElevenLabs voice + music for a reel.
Usage: python eleven.py <reel> [--music]   reads audio/<reel>.json, writes audio/<reel>/line-N.mp3, music.mp3, timing.json
audio/<reel>.json: {"music": "<prompt>", "lines": ["<voice line per scene>", ...]}  (lines optional: music only)
Key: ELEVENLABS_API_KEY env var (falls back to the Windows user environment).
Voice: "voice" in the json (Nimrod, ZiofZHcEBTn5sRySe5h8, a native Hebrew voice), else ELEVENLABS_VOICE_ID, else a premade voice.
Existing music.mp3 is kept unless --music is passed. Hebrew tips: put niqqud on acronyms and on words the voice misreads (עֲרָבִית, שְׁחָקִים).
"""
import json, os, pathlib, re, subprocess, sys, urllib.request, urllib.error
import imageio_ffmpeg

API = "https://api.elevenlabs.io"
HERE = pathlib.Path(__file__).resolve().parent
FF = imageio_ffmpeg.get_ffmpeg_exe()


SUBFIX = {"דפר": "דפ״ר", "מטכל": "מטכ״ל", "גמ״א": "גאמ״א"}  # subtitles show the written form, not the voice spelling


def subtext(line):
    t = re.sub(r"[֑-ׇ]", "", line).replace('"', "״")
    for a, b in SUBFIX.items():
        t = re.sub(rf"(?<![א-ת]){a}(?![א-ת])", b, t)
    return t


def key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if not k and os.name == "nt":
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as h:
                k = winreg.QueryValueEx(h, "ELEVENLABS_API_KEY")[0]
        except OSError:
            pass
    if not k:
        sys.exit("ELEVENLABS_API_KEY is not set")
    return k


KEY = key()


def call(path, body=None, method=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json"}, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"{path}: HTTP {e.code} {e.read().decode(errors='replace')[:500]}")


def seconds(f):
    err = subprocess.run([FF, "-i", str(f)], capture_output=True, text=True).stderr
    h, m, s = err.split("Duration: ")[1].split(",")[0].split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def hebrew_model():
    models = json.loads(call("/v1/models"))
    ok = [m["model_id"] for m in models if m.get("can_do_text_to_speech") and any(l.get("language_id") == "he" for l in m.get("languages", []))]
    for pref in ("eleven_v3", "eleven_multilingual_v3", "eleven_flash_v2_5", "eleven_turbo_v2_5"):
        if pref in ok:
            return pref
    if ok:
        return ok[0]
    sys.exit("no ElevenLabs model lists Hebrew for this account")


def voice_id():
    if spec.get("voice"):
        return spec["voice"]
    if os.environ.get("ELEVENLABS_VOICE_ID"):
        return os.environ["ELEVENLABS_VOICE_ID"]
    voices = json.loads(call("/v1/voices"))["voices"]
    # a confident male narrator reads best for this content; fall back to the first voice
    for want in ("Adam", "Brian", "Daniel", "George", "Liam"):
        for v in voices:
            if v["name"].split(" ")[0] == want:
                return v["voice_id"]
    return voices[0]["voice_id"]


reel = sys.argv[1]
spec = json.loads((HERE / "audio" / f"{reel}.json").read_text(encoding="utf-8"))
out = HERE / "audio" / reel
out.mkdir(parents=True, exist_ok=True)

scenes, texts = [], []  # per scene: line durations, and the line text for subtitles (niqqud stripped)
if spec.get("lines"):
    model, vid = hebrew_model(), voice_id()
    print("voice model", model, "voice", vid)
    for i, group in enumerate(spec["lines"]):
        group = [group] if isinstance(group, str) else group
        scenes.append([]); texts.append([])
        for j, line in enumerate(group):
            texts[-1].append(subtext(line))
            f = out / f"line-{i}-{j}.mp3"
            body = {"text": line, "model_id": model, "language_code": "he",
                    "voice_settings": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.35, "speed": 1.08, "use_speaker_boost": True}}
            f.write_bytes(call(f"/v1/text-to-speech/{vid}?output_format=mp3_44100_128", body))
            scenes[-1].append(round(seconds(f), 3))
            print(f"scene {i} line {j}: {scenes[-1][-1]:.2f}s")
durs = [d for g in scenes for d in g]

(out / "timing.json").write_text(json.dumps({"scenes": scenes, "texts": texts}, ensure_ascii=False), encoding="utf-8")
if (out / "music.mp3").exists() and "--music" not in sys.argv:
    print("music kept (pass --music to regenerate)"); sys.exit(0)

# music long enough for the stretched reel; record.mjs trims it to the video
total = int(spec.get("music_seconds") or (sum(durs) + 0.5 * len(durs) + 12 if durs else 30))
(out / "music.mp3").write_bytes(call("/v1/music?output_format=mp3_44100_128",
                                     {"prompt": spec["music"], "music_length_ms": total * 1000, "force_instrumental": True}))
print(f"music {seconds(out / 'music.mp3'):.1f}s")
