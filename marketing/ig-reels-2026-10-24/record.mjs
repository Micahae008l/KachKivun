// Records engine.html?reel=<id> frame by frame through Chrome's DevTools protocol, adds music.py's soundtrack, encodes with ffmpeg.
// Usage: node record.mjs <ffmpeg.exe> <id> [<id>...]       -> out/<id>.mp4
//        STILLS=1.5,6,12 node record.mjs <ffmpeg.exe> <id> -> out/<id>-still-<t>.png only
// Adapted from ../ig-launch/reel/record.mjs.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [ffmpeg, ...ids] = process.argv.slice(2);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FPS = 30, PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(here, "out");
fs.mkdirSync(outDir, { recursive: true });

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(os.tmpdir(), "kachkivun-rec2-profile")}`,
  "--hide-scrollbars", "--allow-file-access-from-files", "--window-size=1080,1920", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
    if (!target) await sleep(250);
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  await send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });

  for (const reel of ids) {
    const aDir = path.join(here, "audio", reel);
    const tFile = path.join(aDir, "timing.json"), mFile = path.join(aDir, "music.mp3");
    const timing = fs.existsSync(tFile) ? JSON.parse(fs.readFileSync(tFile, "utf8")).scenes : null;
    const q = timing && timing.some((x) => x.length) ? `&timing=${encodeURIComponent(JSON.stringify(timing))}` : "";
    await send("Page.navigate", { url: `${pathToFileURL(path.join(here, "engine.html")).href}?reel=${reel}${q}` });
    await sleep(300);
    for (let i = 0; i < 120 && !(await evaluate("window.__ready === true").catch(() => false)); i++) await sleep(250);
    const dur = await evaluate("window.DUR"), cues = await evaluate("window.CUES"), groove = await evaluate("window.GROOVE"), vo = await evaluate("window.VO");

    if (process.env.STILLS) {
      for (const sec of process.env.STILLS.split(",")) {
        await evaluate(`render(${Number(sec)})`);
        const shot = await send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(outDir, `${reel}-still-${sec}.png`), Buffer.from(shot.data, "base64"));
      }
      console.log(`${reel}: ${dur.toFixed(1)}s, stills saved`);
      continue;
    }

    const framesDir = path.join(os.tmpdir(), `kachkivun-${reel}-frames`);
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    const total = Math.ceil((dur + 0.6) * FPS);
    for (let f = 0; f < total; f++) {
      await evaluate(`render(${(f / FPS).toFixed(4)})`);
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 93 });
      fs.writeFileSync(path.join(framesDir, `${String(f).padStart(5, "0")}.jpg`), Buffer.from(shot.data, "base64"));
    }

    const cueFile = path.join(framesDir, "cues.json"), bed = path.join(framesDir, "music.wav");
    const hasMusic = fs.existsSync(mFile);
    fs.writeFileSync(cueFile, JSON.stringify({ dur: total / FPS, cues, groove, sfx_only: hasMusic }));
    const py = spawnSync("python", [path.join(here, "music.py"), cueFile, bed], { encoding: "utf8" });
    if (py.status !== 0) { console.error(py.stderr); process.exit(1); }

    const out = path.join(outDir, `${reel}.mp4`), D = (total / FPS).toFixed(3);
    const args = ["-y", "-framerate", String(FPS), "-i", path.join(framesDir, "%05d.jpg"), "-i", bed];
    let fc = "";
    if (hasMusic) {
      // ElevenLabs music bed (looped if short), voice lines placed at their scene times, music ducks under the voice
      args.push("-stream_loop", "-1", "-i", mFile);
      const lines = vo.map(([t, i, j]) => [t, path.join(aDir, `line-${i}-${j}.mp3`)]).filter(([, f]) => fs.existsSync(f));
      lines.forEach(([, f]) => args.push("-i", f));
      fc += `[2:a]atrim=0:${D},asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,afade=t=out:st=${(D - 1.6).toFixed(2)}:d=1.6,volume=${lines.length ? 0.42 : 0.8}[m];[1:a]volume=0.45[s];`;
      if (lines.length) {
        lines.forEach(([t], k) => { const ms = Math.round(t * 1000); fc += `[${3 + k}:a]aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${k}];`; });
        fc += `${lines.map((_, k) => `[v${k}]`).join("")}amix=inputs=${lines.length}:normalize=0,volume=1.5[vo];[vo]asplit=2[vk][vv];`;
        fc += `[m][vk]sidechaincompress=threshold=0.02:ratio=8:attack=10:release=350[md];[md][s][vv]amix=inputs=3:normalize=0,alimiter=limit=0.95,atrim=0:${D}[a]`;
      } else fc += `[m][s]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:${D}[a]`;
      args.push("-filter_complex", fc, "-map", "0:v", "-map", "[a]");
    } else args.push("-map", "0:v", "-map", "1:a");
    args.push("-c:a", "aac", "-b:a", "192k", "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out);
    const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
    if (r.status !== 0) { console.error(r.stderr.slice(-2000)); process.exit(1); }
    fs.rmSync(framesDir, { recursive: true, force: true });
    console.log(`${reel}.mp4 ${(total / FPS).toFixed(1)}s ${(fs.statSync(out).size / 1e6).toFixed(1)}MB`);
  }
  ws.close();
} finally {
  chrome.kill();
}
