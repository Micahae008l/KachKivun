"""Regenerate single voice lines until the transcript contains the words that must be heard.
Usage: python fixvoice.py   (edit FIX below). Needs ELEVENLABS_API_KEY and faster-whisper with the ivrit-ai model (GPU or CPU).
Each FIX entry: (reel, scene, line, text for the voice, [words that must appear in the transcript]).
"""
import glob, json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
if os.name == "nt":  # CUDA DLLs installed with pip (nvidia-cublas-cu12, nvidia-cudnn-cu12)
    for b in glob.glob(os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "*", "bin")):
        os.add_dll_directory(b); os.environ["PATH"] = b + os.pathsep + os.environ["PATH"]
from faster_whisper import WhisperModel

src = open("eleven.py", encoding="utf-8").read()
ns = {"__file__": "eleven.py", "__name__": "x"}
exec(src[: src.index("reel = sys.argv[1]")], ns)
call, seconds, FF = ns["call"], ns["seconds"], ns["FF"]
try:
    model = WhisperModel("ivrit-ai/whisper-large-v3-turbo-ct2", device="cuda", compute_type="int8_float16")
except Exception:
    model = WhisperModel("ivrit-ai/whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8")

DAPAR = "דָּפָּר"
FIX = [
    ("intel", 1, 3, "וּשְׁחָקִים: תשעים.", ["^ו?שחקים|^ושחכים"]),
    ("matkal", 0, 0, "סַיֶּרֶת מַטְכָּ\"ל, או שייטת שלוש עשרה? בואו נראה.", ["סיירת", "מטכ״ל|מטכל", "שייטת"]),
]


def transcribe(f):
    raw = subprocess.run([FF, "-loglevel", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    segs, _ = model.transcribe(np.frombuffer(raw, np.int16).astype(np.float32) / 32768, language="he")
    return " ".join(s.text.strip() for s in segs).replace('"', "״")


for reel, i, j, text, must in FIX:
    spec = json.load(open(f"audio/{reel}.json", encoding="utf-8"))
    spec["lines"][i][j] = text
    json.dump(spec, open(f"audio/{reel}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    f = f"audio/{reel}/line-{i}-{j}.mp3"
    for take in range(3):
        body = {"text": text, "model_id": "eleven_v3", "language_code": "he",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.3, "speed": 1.05, "use_speaker_boost": True}}
        open(f, "wb").write(call(f"/v1/text-to-speech/{spec['voice']}?output_format=mp3_44100_128", body))
        heard = transcribe(f)
        ok = all(re.search(m, heard) for m in must)
        print(f"{reel} {i}-{j} take {take + 1}: {'OK ' if ok else 'BAD'} | {heard}")
        if ok:
            break
    tf = f"audio/{reel}/timing.json"
    t = json.load(open(tf, encoding="utf-8"))
    t["scenes"][i][j] = round(seconds(f), 3)
    t["texts"][i][j] = ns["subtext"](text)
    json.dump(t, open(tf, "w", encoding="utf-8"), ensure_ascii=False)
