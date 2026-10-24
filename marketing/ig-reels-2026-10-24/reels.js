// Reel scripts for engine.html. Each scene: { dur (seconds, on the 0.5s beat grid), build(H, scene) -> update fn(s), giant?, tint?, subs?, ambient? }.
// Caption markers: *green pill*  ~red pill~  ^white pill^  | line break. Icons: names from icons.js (lucide).
// Voiced reels: audio/<reel>.json has one list of voice lines per scene; scene.vo = the start time of each line (when rendered with voice).
// Facts: the source videos (../videos-2026-10-24/*/transcript.txt) and the site's blog posts (src/content/blog).

// ---------- shared scene makers ----------
const hook = ({ photo, photoOpts, kick, text, size = 150, y = 560, sub, subY = 1080, icon, giant }) => ({
  dur: 2.5,
  giant,
  build: (H) => [
    photo ? H.photo(photo, photoOpts) : H.color("#0b0f0a", "#07090b"),
    kick ? H.rise(Object.assign(H.el("div", `top:420px`, null, kick), { className: "kick" }), 0, 0, null) : null,
    icon ? H.icon(icon, { x: 430, y: 1450, size: 220, at: 0.6, op: 0.9 }) : null,
    H.words(text, { y, size, at: -0.3, stagger: 0.17 }),
    sub ? H.words(sub, { y: subY, size: 58, at: 1.2, stagger: 0.07, kind: "rise" }) : null,
  ],
});

const outro = ({ text, sub = "kachkivun.com", size = 104, bg = ["#0d140a", "#07090b"], icon = "target" }) => ({
  dur: 3.5,
  subs: false,
  giant: "קח כיוון",
  build: (H) => {
    const url = H.el("div", "position:absolute;left:0;right:0;top:1060px;text-align:center", null,
      `<span style="display:inline-flex;align-items:center;gap:18px;background:var(--g);color:#0b1004;font-weight:900;font-size:56px;padding:26px 56px;border-radius:26px;box-shadow:0 14px 50px oklch(0.82 0.16 128/.35)">התחילו בחינם ←</span>
       <div class="mono" style="margin-top:28px;font-size:44px;direction:ltr;color:#e6eaee">${sub}</div>
       <div style="margin-top:14px;font-size:26px;color:var(--mut)">המלצות לא רשמיות. האתר אינו קשור לצה״ל.</div>`);
    return [H.color(...bg), H.icon(icon, { x: 440, y: 300, size: 200, at: 0.1 }), H.words(text, { y: 560, size, at: 0.05, stagger: 0.14 }), H.rise(url, 1.3, 90, "pop")];
  },
});

// stereotype vs reality: unit slams in, the joke appears, gets stamped, the real fact slides up, the unit's icon draws in below
const unit = ({ name, joke, fact, photo, photoOpts, bg, icon }) => ({
  dur: 4.5,
  giant: name,
  build: (H) => {
    const title = H.el("div", "position:absolute;left:0;right:0;top:380px;text-align:center;font-size:170px;font-weight:900;text-shadow:0 8px 40px rgba(0,0,0,.8)", null, name);
    const jokeBox = H.el("div", "top:660px"); jokeBox.className = "box";
    jokeBox.innerHTML = `<div class="lab">הבדיחה</div><div class="txt" style="font-size:66px">״${joke}״</div>`;
    const stamp = H.el("div", "left:250px;top:610px", null, "סטריאוטיפ"); stamp.className = "stamp"; stamp.dataset.rot = -8;
    const factBox = H.el("div", "top:930px"); factBox.className = "box fact";
    factBox.innerHTML = `<div class="lab">בפועל</div><div class="txt">${fact}</div>`;
    return [
      photo ? H.photo(photo, photoOpts) : H.color(...bg),
      H.icon(icon, { x: 400, y: 1230, size: 280, at: 2.4, color: "var(--g)", op: 0.85 }),
      H.slam(title, 0, { from: 1.8, flash: 0, shake: 14 }),
      H.rise(jokeBox, 0.5, 60, "whoosh"),
      H.slam(stamp, 1.75, { from: 2.6, flash: 0.25, shake: 30, sfx: "stamp" }),
      (t) => { jokeBox.style.filter = `grayscale(${pr(t, 1.75, 2.0)}) brightness(${1 - 0.35 * pr(t, 1.75, 2.0)})`; },
      H.rise(factBox, 2.25, 140, "chime"),
    ];
  },
});

// guess the role: 3 hints with icons on the beat, a 3-2-1 ring, then the answer slams in
const guess = ({ hints, icons, answer, sub, photo, n }) => ({
  dur: 5.5,
  giant: "?",
  build: (H) => {
    const q = H.el("div", "top:380px", null, `תפקיד ${n} מתוך 3 · מי אני?`); q.className = "kick"; q.style.fontSize = "52px";
    const rows = hints.map((h, i) => {
      const r = H.el("div", `top:${480 + i * 170}px;display:flex;align-items:center;gap:28px;padding:28px 40px`, null,
        `<span class="ico" style="width:64px;height:64px;flex:none;color:var(--g)"><svg viewBox="0 0 24 24" style="--d:0">${ICONS[icons[i]]}</svg></span><span style="font-size:52px;font-weight:800">${h}</span>`);
      r.className = "box"; return r;
    });
    const ring = H.el("div", "position:absolute;left:340px;top:1000px;width:400px;height:400px");
    ring.innerHTML = `<svg viewBox="0 0 100 100" width="400" height="400"><circle cx="50" cy="50" r="44" fill="rgba(7,9,11,.7)" stroke="rgba(255,255,255,.15)" stroke-width="5"/><circle id="arc" cx="50" cy="50" r="44" fill="none" stroke="var(--g)" stroke-width="5" stroke-linecap="round" stroke-dasharray="276.5" transform="rotate(-90 50 50)"/></svg><div class="mono" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:180px">3</div>`;
    const arc = ring.querySelector("#arc"), num = ring.querySelector(".mono");
    const ans = H.el("div", "position:absolute;left:0;right:0;top:1030px;text-align:center", null,
      `<span class="pill" style="font-size:130px;font-weight:900;padding:0 56px">${answer}</span>${sub ? `<div style="margin-top:26px;font-size:50px;font-weight:800;text-shadow:0 2px 10px #000">${sub}</div>` : ""}`);
    [2.0, 2.5, 3.0].forEach((c) => H.cue(c, "tick"));
    return [
      photo ? H.photo(photo, { dark: 0.72 }) : H.color("#0a1018", "#07090b"),
      H.rise(q, 0, 0, null),
      ...rows.map((r, i) => H.slideX(r, 0.25 + i * 0.5, -700, "pop")),
      (t) => { const k = pr(t, 1.9, 3.4); H.st(ring, t < 1.8 ? 0 : t < 3.4 ? 1 : 0, `scale(${t < 3.4 ? 1 : 0.6})`); arc.style.strokeDashoffset = 276.5 * k; num.textContent = Math.max(1, 3 - Math.floor(k * 3)); },
      H.slam(ans, 3.5, { from: 2.2, flash: 0.6, shake: 30, sfx: "reveal" }),
    ];
  },
});

// Matkal vs Shayetet stat round: game HUD (name plates + round counter), photo halves, stat icon on the divider, big values.
// Synced to 3 voice lines: label, Matkal value, Shayetet value.
const vsRound = ({ n, label, icon, a, aSub, b, bSub, bars }) => ({
  dur: 3.0,
  giant: label,
  giantY: 1380,
  build: (H, S) => {
    const [tl, ta, tb] = S.vo && S.vo.length >= 3 ? S.vo : [0.05, 0.6, 1.3];
    const halves = H.el("div", "position:absolute;inset:0", null,
      `<div style="position:absolute;top:0;bottom:0;right:0;width:50%;overflow:hidden"><div class="ph" style="position:absolute;inset:-40px -300px;background:url('${IMG["slide-6"]}') 70% center/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,40,8,.82),rgba(7,9,11,.94) 70%)"></div></div>
       <div style="position:absolute;top:0;bottom:0;left:0;width:50%;overflow:hidden"><div class="ph" style="position:absolute;inset:-40px -300px;background:url('${IMG["slide-4"]}') 30% center/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,22,48,.82),rgba(7,9,11,.94) 70%)"></div></div>
       <div style="position:absolute;top:0;bottom:0;left:537px;width:6px;background:linear-gradient(180deg,transparent,#fff 30%,#fff 70%,transparent);box-shadow:0 0 30px #fff"></div>`);
    S.c.prepend(halves);
    S.credit = "Photos: Israel Defense Forces, CC BY 2.0";
    const phs = [...halves.querySelectorAll(".ph")];
    const hud = H.el("div", "position:absolute;left:40px;right:40px;top:330px", null,
      `<div style="display:flex;justify-content:space-between;align-items:center">
         <div style="width:400px"><div style="font-size:44px;font-weight:900;color:var(--g)">סיירת מטכ״ל</div><div style="height:16px;border-radius:8px;background:var(--g);margin-top:8px;box-shadow:0 0 20px var(--g)"></div></div>
         <div class="mono" style="font-size:30px;color:#fff;background:rgba(255,255,255,.12);padding:8px 18px;border-radius:12px;direction:ltr">ROUND ${n}/4</div>
         <div style="width:400px;text-align:left"><div style="font-size:44px;font-weight:900;color:#8ec5ff">שייטת 13</div><div style="height:16px;border-radius:8px;background:#8ec5ff;margin-top:8px;box-shadow:0 0 20px #8ec5ff"></div></div>
       </div>`);
    const badge = H.el("div", "position:absolute;left:390px;top:520px;width:300px;height:300px;border-radius:50%;background:rgba(7,9,11,.85);border:4px solid #fff;box-shadow:0 0 50px rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center", null,
      `<div class="ico" style="width:170px;height:170px;color:#fff"><svg viewBox="0 0 24 24">${ICONS[icon]}</svg></div>`);
    const icoEl = badge.querySelector(".ico");
    const lab = H.el("div", "position:absolute;left:0;right:0;top:850px;text-align:center", null, `<span class="pill white" style="font-size:70px;font-weight:900">${label}</span>`);
    const val = (side, v, sub, color) => H.el("div", `position:absolute;${side}:20px;width:500px;top:1000px;text-align:center;line-height:1.05`, null,
      `<div style="font-size:${v.length > 6 ? 84 : 112}px;font-weight:900;color:${color};text-shadow:0 6px 30px #000">${v}</div><div style="font-size:42px;font-weight:800;margin-top:10px;text-shadow:0 3px 14px #000">${sub}</div>`);
    const va = val("right", a, aSub, "#fff"), vb = val("left", b, bSub, "#fff");
    const ups = [
      (t) => phs.forEach((p, k) => (p.style.transform = `scale(${1.08 - 0.06 * pr(t, 0, S.dur)}) translateX(${(k ? -1 : 1) * 20 * pr(t, 0, S.dur)}px)`)),
      H.rise(hud, 0, 30, null),
      (t) => { H.st(badge, eo(pr(t, tl, tl + 0.15)), `scale(${lerp(1.6, 1, eo5(pr(t, tl, tl + 0.3)))}) rotate(${lerp(-90, 0, eo5(pr(t, tl, tl + 0.4)))}deg)`); icoEl.style.setProperty("--d", 1 - eo(pr(t, tl + 0.1, tl + 0.8))); },
      H.slam(lab, tl + 0.1, { from: 1.6, flash: 0, shake: 0, sfx: "pop" }),
      H.slideX(va, ta, 500, "slam"), H.slideX(vb, tb, -500, "slam"),
    ];
    if (bars) {
      const mk = (side, color) => H.el("div", `position:absolute;${side}:60px;top:1250px;width:420px;height:44px;border-radius:22px;background:rgba(255,255,255,.12);overflow:hidden`, null, `<div style="height:100%;width:0;background:${color};border-radius:22px;box-shadow:0 0 20px ${color}"></div>`);
      const ba = mk("right", "var(--g)"), bb = mk("left", "#8ec5ff");
      ups.push((t) => { ba.firstChild.style.width = `${bars[0] * eo(pr(t, ta + 0.1, ta + 0.8)) * 100}%`; bb.firstChild.style.width = `${bars[1] * eo(pr(t, tb + 0.1, tb + 0.8)) * 100}%`; ba.style.opacity = pr(t, ta, ta + 0.1); bb.style.opacity = pr(t, tb, tb + 0.1); });
    }
    return ups;
  },
});

// this-or-that round for open vs closed base: question on top, two answers with icons, stacked
const torRound = ({ q, open, closed, iconOpen, iconClosed }) => ({
  dur: 3.0,
  ambient: false,
  build: (H) => {
    H.el("div", "position:absolute;inset:0", null,
      `<div style="position:absolute;left:0;right:0;top:0;height:50%;background:linear-gradient(180deg,#1b4512,#0d1a09)"></div>
       <div style="position:absolute;left:0;right:0;bottom:0;height:50%;background:linear-gradient(0deg,#0e2242,#0a111b)"></div>
       <div style="position:absolute;left:-100px;top:420px;font-size:380px;font-weight:900;color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.07);white-space:nowrap">פתוח פתוח</div>
       <div style="position:absolute;left:-100px;top:1250px;font-size:380px;font-weight:900;color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.07);white-space:nowrap">סגור סגור</div>`);
    const qn = H.el("div", "position:absolute;left:0;right:0;top:330px;text-align:center", null, `<span class="pill white" style="font-size:64px;font-weight:900">${q}</span>`);
    const half = (top, label, color, text) => H.el("div", `position:absolute;left:80px;right:80px;top:${top}px;text-align:center`, null, `<div style="font-size:42px;font-weight:800;color:${color}">${label}</div><div style="font-size:96px;font-weight:900;line-height:1.1;text-shadow:0 6px 24px #000">${text}</div>`);
    const a = half(520, "פתוח", "var(--g)", open), b = half(1010, "סגור", "#8ec5ff", closed);
    return [H.slam(qn, 0.05, { from: 1.5, flash: 0, shake: 0, sfx: "pop" }),
      H.icon(iconOpen, { x: 440, y: 740, size: 200, at: 0.6, color: "var(--g)" }), H.slideX(a, 0.5, 700, "slam"),
      H.icon(iconClosed, { x: 440, y: 1230, size: 200, at: 1.2, color: "#8ec5ff" }), H.slideX(b, 1.1, -700, "slam")];
  },
});

// one intelligence track: icon + name, what you do, the requirement, then a note (green) or warning (red). Synced to up to 3 voice lines.
const track = ({ n, name, what, req, note, warn, photo, icon, big }) => ({
  dur: 5.0,
  giant: big,
  giantY: 1300,
  build: (H, S) => {
    const [t1, t2, t3] = S.vo ? [S.vo[0], S.vo[1] ?? S.vo[0] + 1.2, S.vo[2] ?? S.vo[0] + 2.4] : [0.35, 1.5, 2.7];
    const k = H.el("div", "top:360px", null, `מסלול ${n} מתוך 4`); k.className = "kick";
    const nm = H.el("div", "position:absolute;right:80px;left:300px;top:430px;text-align:right", null, `<span class="pill" style="font-size:112px;font-weight:900;padding:0 40px">${name}</span>`);
    const w = H.el("div", "top:650px"); w.className = "box"; w.innerHTML = `<div class="lab">מה עושים</div><div class="txt" style="font-size:52px">${what}</div>`;
    const r = H.el("div", "position:absolute;left:80px;right:80px;top:920px;text-align:center;font-size:62px;font-weight:900;line-height:1.25;text-shadow:0 4px 20px #000", null, req);
    const x = note || warn ? H.el("div", "top:1070px") : null;
    if (x) { x.className = "box" + (warn ? "" : " fact"); if (warn) x.style.borderColor = "var(--red)"; x.innerHTML = `<div class="txt" style="font-size:46px">${warn ? "⚠️ " : ""}${warn || note}</div>`; }
    return [photo ? H.photo(photo, { dark: 0.8, pos: "70% center" }) : H.color("#08100c", "#07090b"), H.rise(k, 0, 0, null),
      H.icon(icon, { x: 80, y: 420, size: 190, at: 0.1 }),
      H.slam(nm, 0.05, { from: 2, flash: 0, shake: 14 }), H.rise(w, t1 + 0.2, 70), H.slam(r, t2, { from: 1.5, flash: 0, shake: 0, sfx: "pop" }), x ? H.rise(x, t3, 90, warn ? "stamp" : "chime") : null];
  },
});

// titled list: rows with icons punch in one by one (synced to voice lines 1..n; line 0 is the title)
const list = ({ title, items, icons, tone = "good", dur = 5.0, bg = ["#0b120a", "#07090b"], giant, bigIcon }) => ({
  dur,
  giant,
  build: (H, S) => {
    const times = S.vo && S.vo.length > items.length ? S.vo.slice(1) : items.map((_, i) => 0.7 + i * 1.2);
    const col = tone === "good" ? "var(--g)" : "var(--red)";
    const rows = items.map((it, i) => {
      const r = H.el("div", `top:${600 + i * 200}px;display:flex;align-items:center;gap:30px;padding:30px 40px`, null,
        `<span class="ico" style="width:86px;height:86px;flex:none;color:${col}"><svg viewBox="0 0 24 24" style="--d:0">${ICONS[icons[i]]}</svg></span><span style="font-size:52px;font-weight:800;line-height:1.2">${it}</span>`);
      r.className = "box"; return r;
    });
    return [H.color(...bg), bigIcon ? H.icon(bigIcon, { x: 760, y: 1230, size: 240, at: 0.3, color: col, op: 0.5, glow: false }) : null,
      H.words(title, { y: 390, size: 104, at: 0 }), ...rows.map((r, i) => H.slideX(r, times[i], -700, "pop"))];
  },
});

// ---------- the reels ----------
const REELS = {
  // 1. Tag-a-friend stereotypes. Sends drive reach to non-followers.
  stereotypes: {
    tint: ["oklch(0.55 0.16 300)", "oklch(0.55 0.14 130)"],
    scenes: [
      hook({ photo: "slide-7", photoOpts: { dark: 0.6 }, kick: "סטריאוטיפ מול מציאות", text: "איזה סוג בן אדם | אתה *לפי* *היחידה?*", size: 140, y: 560, icon: "users" }),
      unit({ name: "מ״צ", joke: "המלשינים של הצבא", fact: "שומרים על <span class='g'>החוסן המוסרי</span> של צה״ל", bg: ["#1a0f24", "#07090b"], icon: "siren" }),
      unit({ name: "חיל האוויר", joke: "מפונקים, לא נרדמים בלי שמיכי", fact: "בקרה אווירית: <span class='g'>משמרות וכוננות</span> באמצע הלילה", photo: "slide-10", photoOpts: { dark: 0.7 }, icon: "plane" }),
      unit({ name: "גולני", joke: "גברים על", fact: "4 חודשי טירונות + 3 חודשי אימון מתקדם. <span class='g'>פרופיל 82+</span>", photo: "slide-6", photoOpts: { dark: 0.65, pos: "70% center" }, icon: "crosshair" }),
      unit({ name: "טבח", joke: "שולט בבסיס בגלל השניצל", fact: "נחשב <span class='g'>ניסיון לתעודת שף</span> אזרחי", bg: ["#2a170a", "#07090b"], icon: "chef-hat" }),
      outro({ text: "תייגו את החבר | שלכם ב*מ״צ* 😂", icon: "megaphone" }),
    ],
  },

  // 2. Navy guess-the-role quiz. Comments ("how many did you get?") and sends.
  navy: {
    tint: ["oklch(0.5 0.14 240)", "oklch(0.55 0.12 200)"],
    scenes: [
      hook({ photo: "slide-4", photoOpts: { dark: 0.5 }, kick: "חיל הים", text: "נחשו את *התפקיד* | ב־3 רמזים", size: 140, sub: "כמה תצליחו? 👀", icon: "anchor", giant: "חיל הים" }),
      guess({ n: 1, hints: ["הקצינים של זרוע הים", "קורס של כשנתיים וחצי", "תואר מאוניברסיטת חיפה"], icons: ["star", "hourglass", "graduation-cap"], answer: "חובל/ת", photo: "slide-4" }),
      guess({ n: 2, hints: ["עובדת מחדר שליטה", "מנטרת תנועת כלי שיט", "מזהה חריגים ומתריעה"], icons: ["radar", "ship", "bell"], answer: "בק״שית", sub: "בקרית שליטה ימית" }),
      guess({ n: 3, hints: ["חלק מצוות הצוללת", "פרופיל 82 · דפ״ר 60", "בנים בלבד"], icons: ["waves", "shield-check", "users"], answer: "צוללן", photo: "slide-4" }),
      outro({ text: "כמה ניחשתם? | *תכתבו* בתגובות", size: 100, bg: ["#0a1422", "#07090b"], icon: "trophy" }),
    ],
  },

  // 3. Intelligence, exactly as the source video lays it out. Voiced (audio/intel.json).
  intel: {
    tint: ["oklch(0.55 0.14 160)", "oklch(0.5 0.12 260)"],
    scenes: [
      hook({ photo: "slide-6", photoOpts: { dark: 0.6, pos: "70% center" }, kick: "חיל המודיעין", text: "רוצים *מודיעין?*", size: 170, y: 540, sub: "4 מסלולי מיון. ולכל אחד *דפ״ר* אחר", subY: 1000, icon: "radar", giant: "מודיעין" }),
      {
        dur: 6.5,
        giant: "דפ״ר",
        build: (H, S) => {
          const bg = H.color("#08100c", "#07090b");
          const title = H.el("div", "top:380px", null, "כמה דפ״ר צריך?"); title.className = "kick"; title.style.fontSize = "60px"; title.style.color = "#fff";
          const Y = (d) => 1220 - ((d - 10) / 80) * 720;
          const trackEl = H.el("div", "position:absolute;left:180px;top:500px;width:80px;height:720px;border-radius:40px;background:rgba(255,255,255,.08);border:2px solid var(--line);overflow:hidden", null, '<div style="position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,var(--gd),var(--g));border-radius:40px;box-shadow:0 0 40px var(--g)"></div>');
          const fill = trackEl.firstChild;
          const val = H.el("div", "position:absolute;left:30px;width:140px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:64px;color:var(--g);text-shadow:0 2px 12px #000");
          const marks = [[50, "ערבית", "50+", "מגמת ערבית", 1040, "headphones"], [60, "גאמ״א", "60+", "תפקידי הסייבר", 850, "terminal"], [60, "כלל חמ״ן", "60+", "4 יח״ל מתמטיקה + ריאלית", 660, "search"], [90, "שחקים", "90", "9 מסלולים", 470, "brain"]];
          const at = S.vo && S.vo.length >= 4 ? S.vo.map((v) => v + 0.1) : [1.4, 2.4, 3.3, 4.6];
          const labs = marks.map(([d, n, num, sub, slot, ic]) => H.el("div", `position:absolute;right:70px;left:300px;top:${slot}px;display:flex;align-items:center;gap:22px;justify-content:flex-start`, null,
            `<span class="ico" style="width:84px;height:84px;flex:none;color:var(--g)"><svg viewBox="0 0 24 24" style="--d:0">${ICONS[ic]}</svg></span><div><div style="font-size:${d === 90 ? 72 : 60}px;font-weight:900;line-height:1.05">${d === 90 ? `<span class="pill">${n}</span>` : n} <span class="mono" style="font-size:44px;color:var(--g);direction:ltr;unicode-bidi:isolate">${num}</span></div><div style="font-size:34px;color:var(--mut);font-weight:700">${sub}</div></div>`));
          const ups = [bg, H.rise(title, 0, 30, null)];
          marks.forEach(([d], i) => ups.push(d === 90 ? H.slam(labs[i], at[i], { from: 1.8, flash: 0.5, shake: 24, sfx: "reveal" }) : H.slideX(labs[i], at[i], -500, "pop")));
          const keys = [[0.2, 10], [at[0], 50], [at[1], 60], [at[2], 60], [at[3], 90]];
          ups.push((t) => {
            let d = 10;
            for (let k = 1; k < keys.length; k++) if (t >= keys[k - 1][0]) d = lerp(keys[k - 1][1], keys[k][1], eo(pr(t, keys[k - 1][0], keys[k][0])));
            fill.style.height = `${((d - 10) / 80) * 100}%`; val.textContent = Math.round(d); val.style.top = `${Y(d) - 40}px`;
          });
          return ups;
        },
      },
      track({ n: 1, name: "שחקים", what: "המסלול המשולב של חיל המודיעין: 9 מסלולים", req: "דפ״ר <span class='g'>90</span>", warn: "לא כל מי שקיבל 90 מזומן. רק האחוזון העליון.", photo: "slide-6", icon: "brain", big: "90" }),
      {
        // the 9 שחקים tracks as chips, popping in across the voice line
        dur: 6.0,
        giant: "שחקים",
        build: (H, S) => {
          const names = ["חבצלות", "ארזים", "אמנון", "אח״מ", "אע״מ", "אמ״מ", "מח״א", "שוב״ל", "שמ״מ"];
          const t0 = S.vo ? S.vo[0] + 0.4 : 0.6, span = S.vo ? Math.max(2.5, (S.dur - t0) * 0.75) : 3.6;
          const chips = names.map((nm, i) => H.el("div", `position:absolute;left:${80 + (2 - (i % 3)) * 312}px;top:${560 + Math.floor(i / 3) * 190}px;width:290px;height:160px;border-radius:30px;background:rgba(16,26,12,.92);border:2px solid oklch(0.82 0.16 128/.6);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 10px 40px rgba(0,0,0,.5)`, null,
            `<div class="mono" style="font-size:30px;color:var(--g)">0${i + 1}</div><div style="font-size:56px;font-weight:900">${nm}</div>`));
          return [H.color("#08100c", "#07090b"), H.words("*9* המסלולים | של שחקים", { y: 330, size: 100, at: 0 }),
            H.icon("sparkles", { x: 440, y: 1170, size: 200, at: t0 + span, op: 0.8 }),
            ...chips.map((c, i) => H.slam(c, t0 + (span * i) / 9, { from: 1.7, flash: 0, shake: 0, sfx: "pop" }))];
        },
      },
      track({ n: 2, name: "גאמ״א", what: "תפקידי הסייבר בכל יחידות המודיעין, בצבא ובשירותי הביטחון", req: "דפ״ר <span class='g'>60+</span>", note: "סיימתם מגמת מחשבים? זה המסלול בשבילכם 💻", icon: "terminal", big: "60+" }),
      track({ n: 3, name: "ערבית", what: "האזנות, מחקר ומודיעין בשפה הערבית", req: "דפ״ר <span class='g'>50+</span> · מגמת ערבית", icon: "headphones", big: "50+" }),
      track({ n: 4, name: "כלל חמ״ן", what: "שפות, אמל״ח, פענוח ומחקר, בכל יחידות המודיעין", req: "דפ״ר <span class='g'>60+</span> · 4 יח״ל מתמטיקה · מגמה ריאלית", warn: "התמיינתם לערבית או לשחקים? לכלל חמ״ן כבר אי אפשר.", icon: "search", big: "60+" }),
      outro({ text: "שלחו למי | שחולם על *מודיעין* 🎯", size: 100, icon: "radar" }),
    ],
  },

  // 4. Open vs closed base: the source video's pros and cons of daily service, then a comment poll.
  base: {
    tint: ["oklch(0.55 0.14 130)", "oklch(0.5 0.13 250)"],
    scenes: [
      {
        dur: 2.5,
        ambient: false,
        build: (H) => {
          const top = H.el("div", "position:absolute;left:0;right:0;top:0;height:50%;background:linear-gradient(180deg,#1f5214,#0d1a09)");
          const bot = H.el("div", "position:absolute;left:0;right:0;bottom:0;height:50%;background:linear-gradient(0deg,#102a52,#0a1220)");
          const vs = H.el("div", "position:absolute;left:0;right:0;top:880px;text-align:center", null, '<span class="pill white" style="font-size:90px;font-weight:900">או</span>');
          return [
            (t) => { top.style.transform = `translateX(${(1 - eo5(pr(t, -0.3, 0.3))) * 1080}px)`; bot.style.transform = `translateX(${(1 - eo5(pr(t, -0.2, 0.4))) * -1080}px)`; },
            H.icon("house", { x: 120, y: 500, size: 220, at: 0.1, color: "#fff", op: 0.5, glow: false }),
            H.icon("building-2", { x: 740, y: 1180, size: 220, at: 0.9, color: "#fff", op: 0.5, glow: false }),
            H.words("בסיס *פתוח*", { y: 480, size: 150, at: -0.3 }),
            H.slam(vs, 0.5, { from: 2, flash: 0.3, shake: 18 }),
            H.words("בסיס *סגור?*", { y: 1080, size: 150, at: 0.9 }),
          ];
        },
      },
      torRound({ q: "איפה ישנים?", open: "בבית, כל לילה", closed: "בבסיס", iconOpen: "bed-double", iconClosed: "tent" }),
      list({ title: "יומיות: *היתרונות*", items: ["בבית כל יום: המיטה, האוכל, המקלחת", "ממשיכים לימודים או עבודה בצד", "ג׳וב טוב? בדרך הביתה כבר ב־12:30"], icons: ["house", "book-open", "sun"], dur: 5.5, giant: "יומיות", bigIcon: "house" }),
      list({ title: "יומיות: ~החסרונות~", tone: "bad", bg: ["#1a0d0d", "#07090b"], items: ["שעה וחצי עד שעתיים נסיעה לכל כיוון", "לפעמים נשארים עד 17:00 או 18:00", "חוזרים ב־19:00 והיום נגמר"], icons: ["bus", "alarm-clock", "moon"], dur: 5.5, giant: "יומיות", bigIcon: "hourglass" }),
      torRound({ q: "החבר׳ה", open: "כולם רצים הביתה", closed: "אווירה משפחתית", iconOpen: "door-open", iconClosed: "users" }),
      {
        dur: 3.5,
        giant: "3 שעות",
        build: (H) => [H.photo("dune", { dark: 0.65 }),
          H.icon("bus", { x: 420, y: 1190, size: 240, at: 0.2 }),
          H.words("שעה וחצי | לכל כיוון", { y: 420, size: 120, at: 0 }),
          H.words("= *3* *שעות* | ביום בדרכים", { y: 780, size: 110, at: 1.0 }),
          H.words("תעשו את החשבון *לפני* השאלון", { y: 1080, size: 52, at: 2.2, stagger: 0.05, kind: "rise" })],
      },
      outro({ text: "פתוח או סגור? | *תכתבו* בתגובות 👇", size: 98, icon: "circle-help" }),
    ],
  },

  // 5. Matkal vs Shayetet 13: fighting-game VS screen with stat rounds. Voiced (audio/matkal.json).
  matkal: {
    tint: ["oklch(0.55 0.15 130)", "oklch(0.5 0.14 245)"],
    scenes: [
      {
        dur: 3.0,
        ambient: false,
        build: (H, S) => {
          const L = H.el("div", "position:absolute;top:0;bottom:0;right:0;width:50%;overflow:hidden", null, `<div style="position:absolute;inset:0 -300px;background:url('${IMG["slide-6"]}') 70% center/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,30,5,.45),rgba(7,9,11,.9))"></div>`);
          const R = H.el("div", "position:absolute;top:0;bottom:0;left:0;width:50%;overflow:hidden", null, `<div style="position:absolute;inset:0 -300px;background:url('${IMG["slide-4"]}') 30% center/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,15,35,.45),rgba(7,9,11,.9))"></div>`);
          S.credit = "Photos: Israel Defense Forces, CC BY 2.0";
          H.el("div", "position:absolute;top:0;bottom:0;left:534px;width:12px;background:#fff;box-shadow:0 0 60px #fff,0 0 120px #8ec5ff");
          const n1 = H.el("div", "position:absolute;right:30px;width:480px;top:560px;text-align:center;font-size:100px;font-weight:900;line-height:1.02;text-shadow:0 6px 30px #000", null, 'סיירת<br><span class="g">מטכ״ל</span>');
          const n2 = H.el("div", "position:absolute;left:30px;width:480px;top:560px;text-align:center;font-size:100px;font-weight:900;line-height:1.02;text-shadow:0 6px 30px #000", null, 'שייטת<br><span style="color:#8ec5ff">13</span>');
          const vs = H.el("div", "position:absolute;left:0;right:0;top:880px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:240px;font-weight:800;font-style:italic;color:#fff;text-shadow:0 0 60px rgba(255,255,255,.6),0 10px 30px #000", null, "VS");
          const sub = H.el("div", "position:absolute;left:0;right:0;top:1180px;text-align:center", null, '<span class="pill white" style="font-size:48px;font-weight:900">4 סיבובים. מי לוקח?</span>');
          return [
            (t) => { L.style.transform = `translateX(${(1 - eo5(pr(t, -0.2, 0.35))) * 600}px)`; R.style.transform = `translateX(${(1 - eo5(pr(t, -0.1, 0.45))) * -600}px)`; },
            H.slideX(n1, 0.0, 500, null), H.slideX(n2, 0.25, -500, null),
            H.slam(vs, 0.75, { from: 3, flash: 0.7, shake: 36, sfx: "reveal" }),
            H.rise(sub, 1.5, 60, "pop"),
          ];
        },
      },
      vsRound({ n: 1, label: "הכשרה", icon: "calendar", a: "16", aSub: "חודשים", b: "20", bSub: "חודשים", bars: [0.8, 1.0] }),
      vsRound({ n: 2, label: "גיבוש", icon: "flame", a: "אחוד", aSub: "עם שלדג", b: "5 ימים", bSub: "בים וביבשה" }),
      vsRound({ n: 3, label: "שירות", icon: "clock", a: "חובה", aSub: "+ 3 שנות קבע", b: "36 ח׳", bSub: "מתום ההכשרה" }),
      vsRound({ n: 4, label: "בסוף", icon: "award", a: "חסוי", aSub: "לחלוטין", b: "כנפי", bSub: "העטלף" }),
      {
        dur: 3.0,
        giant: "יום סיירות",
        build: (H, S) => {
          const t2 = S.vo ? S.vo[0] + 2.2 : 1.6;
          const chips = H.el("div", "position:absolute;left:0;right:0;top:1000px;text-align:center;display:flex;gap:24px;justify-content:center", null,
            '<span class="pill white" style="font-size:58px;font-weight:900">פרופיל 82+</span><span class="pill white" style="font-size:58px;font-weight:900">דפ״ר 50+</span>');
          return [H.photo("dawn", { dark: 0.55 }), H.icon("door-open", { x: 410, y: 300, size: 260, at: 0.1, color: "#fff" }),
            H.words("אותה דלת | לשתיהן:", { y: 560, size: 104 }),
            H.words("*יום* *סיירות*", { y: 820, size: 130, at: 0.8 }),
            H.rise(chips, t2, 70, "pop")];
        },
      },
      outro({ text: "ואתם? *מטכ״ל* | או *שייטת?* 👇", size: 104, icon: "swords" }),
    ],
  },

  // 6. POV: the placement you didn't want. Voiced (audio/placement.json).
  placement: {
    tint: ["oklch(0.55 0.18 25)", "oklch(0.55 0.14 130)"],
    scenes: [
      {
        dur: 3.0,
        giant: "POV",
        build: (H) => {
          const n = H.el("div", "position:absolute;left:90px;right:90px;top:620px;border-radius:44px;background:rgba(245,247,250,.96);color:#0b0d10;padding:34px 40px;box-shadow:0 30px 80px rgba(0,0,0,.6);display:flex;gap:28px;align-items:center", null,
            `<div style="width:110px;height:110px;border-radius:28px;background:#0b0d10;display:flex;align-items:center;justify-content:center;flex:none;color:#fff" class="ico"><svg viewBox="0 0 24 24" style="--d:0;width:70px;height:70px">${ICONS.bell}</svg></div>
             <div style="flex:1"><div style="font-size:34px;font-weight:700;color:#6b7480">עכשיו</div><div style="font-size:50px;font-weight:900;line-height:1.15">עדכון חדש: השיבוץ שלך</div></div>`);
          const role = H.el("div", "position:absolute;left:0;right:0;top:930px;text-align:center", null, '<span class="pill red" style="font-size:150px;font-weight:900;padding:0 60px">???</span>');
          return [H.color("#120c0c", "#07090b"),
            H.words("POV:", { y: 420, size: 110, at: -0.3 }),
            (t) => H.st(n, eo(pr(t, 0.15, 0.3)), `translateY(${(1 - eo5(pr(t, 0.15, 0.6))) * -500}px)`),
            H.slam(role, 1.4, { from: 2.4, flash: 0.4, shake: 30, sfx: "stamp" })];
        },
      },
      {
        dur: 2.0,
        build: (H) => [H.color("#1a0d0d", "#07090b"),
          H.words("ו... זה | ~לא~ מה שרציתם", { y: 560, size: 130 }),
          H.words("😶", { y: 960, size: 200, at: 0.9 })],
      },
      list({ title: "איך נקבע *השיבוץ?*", items: ["צרכי הצבא", "הנתונים שלכם: צו ראשון ויום המא״ה", "הדירוגים שלכם בשאלון ההעדפות"], icons: ["shield", "file-text", "list-checks"], dur: 5.0, giant: "שיבוץ", bigIcon: "scale" }),
      ...[["להכיר את התפקיד", "הרבה פעמים ״לא רציתי״ זה ״לא הכרתי״", "book-open"], ["לפנות למיטב", "האזור האישי באתר מתגייסים או 1111", "phone"], ["ביום הגיוס", "לבקש לדבר עם קצין/ת מיון", "users"]].map(([h, s, ic], i) => ({
        dur: 2.5,
        giant: "צעד " + (i + 1),
        build: (H, S) => {
          const [th, ts] = S.vo ? [S.vo[0] + 0.1, S.vo[1] ?? S.vo[0] + 1] : [0.45, 1.1];
          const num = H.el("div", "position:absolute;right:120px;top:340px;font-family:'JetBrains Mono',monospace;font-size:240px;font-weight:800;color:var(--g);text-shadow:0 0 60px oklch(0.82 0.16 128/.4)", null, String(i + 1));
          const sub = H.el("div", "position:absolute;left:90px;right:90px;top:960px;text-align:center;font-size:56px;font-weight:700;color:#e3e8ee;line-height:1.3", null, s);
          return [H.color("#0b120a", "#07090b"), H.icon(ic, { x: 120, y: 360, size: 230, at: 0.1 }), H.slam(num, 0, { from: 1.8, flash: 0, shake: 16 }), H.words(h, { y: 720, size: 104, at: th }), H.rise(sub, ts, 60, "whoosh")];
        },
      })),
      {
        dur: 3.0,
        giant: "שאלון",
        build: (H) => [H.color("#0d140a", "#07090b"), H.icon("list-checks", { x: 410, y: 300, size: 260, at: 0.1 }),
          H.words("הכי חשוב: | *שאלון* *ההעדפות*", { y: 600, size: 120 }),
          H.words("שם זה נקבע. תגיעו עם רשימה מוכנה.", { y: 1020, size: 56, at: 1.2, stagger: 0.06, kind: "rise" })],
      },
      outro({ text: "שלחו לחבר | *לפני* השאלון 📩", size: 104, icon: "megaphone" }),
    ],
  },
};
