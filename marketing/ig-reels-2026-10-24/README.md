# קח כיוון reels (Instagram / TikTok)

Six original, animated vertical reels (1080x1920) for kachkivun.com, built from the topics of 7 WhatsApp videos
(their transcripts and content packs are in `../videos-2026-10-24/vN/`). No third-party footage, no people on camera.

| id | Reel | Audio |
|---|---|---|
| `stereotypes` | Unit stereotypes vs reality (tag-a-friend) | ElevenLabs music |
| `navy` | Navy: guess the role in 3 hints | ElevenLabs music |
| `matkal` | Sayeret Matkal vs Shayetet 13, fighting-game VS | Voice (Nimrod) + music |
| `intel` | Intelligence screening tracks, DAPAR meter, the 9 שחקים tracks | Voice (Nimrod) + music |
| `base` | Open vs closed base, pros and cons | ElevenLabs music |
| `placement` | POV: the placement you didn't want | Voice (Nimrod) + music |

Finished videos: `out/<id>.mp4`. Post copy and hashtags: `captions.md`. Gallery: open `index.html` through any static server
(`python -m http.server 8091`, then http://localhost:8091).

## Setup on a new computer

1. Node 22+ and Google Chrome (set `CHROME=<path>` if Chrome is not in the default place).
2. `pip install -r requirements.txt`
3. ElevenLabs key, only needed to make new voice or music: set `ELEVENLABS_API_KEY` in the environment
   (Windows: `[Environment]::SetEnvironmentVariable('ELEVENLABS_API_KEY','<key>','User')`). Never commit it.
   Commercial use of the audio needs a paid ElevenLabs plan.

## Render

```
python render.py                 # all six -> out/
python render.py matkal intel    # some
python render.py matkal --stills 1.5,6,10   # quick look -> stills/
```

The voice and music files are committed in `audio/`, so rendering never calls ElevenLabs.

## How it works

- `engine.html`: the animation engine. Every frame is a pure function `render(t)`. Helpers: `H.photo`, `H.color`, `H.words`
  (kinetic captions: `*green pill*`, `~red pill~`, `^white pill^`, `|` line break), `H.slam`, `H.rise`, `H.slideX`, `H.icon`
  (lucide line icons that draw in), `H.giant` (huge outlined background word). Every scene also gets an ambient layer
  (drifting light, particles). Voiced reels get karaoke subtitles from the voice timing.
- `reels.js`: the six reels as lists of scenes. Scene makers: `hook`, `unit`, `guess`, `vsRound`, `torRound`, `track`, `list`, `outro`.
- `record.mjs`: drives headless Chrome frame by frame, mixes ElevenLabs music (ducked under the voice), the voice lines,
  and synthesized sound effects (`music.py`), and encodes with ffmpeg.
- `audio/<id>.json`: the music prompt, the voice id, and the voice lines (one list per scene, in scene order).
  A scene with voice stretches to fit its lines, and its animations sync to `scene.vo` (the start time of each line).
- `eleven.py <id> [--music]`: makes the voice lines (and music with `--music`) into `audio/<id>/`, plus `timing.json`.
- `fixvoice.py`: regenerates single lines until a Hebrew transcription confirms the key words (edit its `FIX` list).
- `icons.js`: icons extracted from lucide (ISC). Photos: CC BY / public domain only, credited on screen and in captions.

## Rules for this content

- Never use the em dash character in any copy.
- Owner: מייקל חדד (never מיכאל).
- Offer: places 5 and 4 are free; places 3, 2, 1 unlock for ₪24.99 once. The גיבוש tool is free. Site is unofficial, not IDF.
- Facts come from the source video (follow what it says exactly) or from the site's blog posts, which cite mitgaisim.idf.il.
  Intel numbers per the source video: שחקים דפ״ר 90 (only the top percentile is called), גאמ״א 60+, ערבית 50+ with an Arabic
  major, כלל חמ״ן 60+ with 4 units of math and a science major; screening for ערבית or שחקים closes כלל חמ״ן.
- Voice: Nimrod (`ZiofZHcEBTn5sRySe5h8`), a native Hebrew ElevenLabs voice, model `eleven_v3`. Ask the owner before changing it.
  Put niqqud on words it misreads: `עֲרָבִית`, `שְׁחָקִים`, `דָּפָּר`, `מַטְכָּ"ל`. Subtitles strip niqqud and show the written form.
- Design for retention: the hook is on screen at frame 0, something changes every 1 to 2 seconds, cuts land on the 120 BPM beat,
  text stays in the safe zone (y 300 to 1250, clear of the right-side buttons), each ending asks for a send or a comment.
