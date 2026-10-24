// Reel scripts for engine.html. Each scene: { dur (seconds, on the 0.5s beat grid), build(H, scene) -> update fn(s) }.
// Caption markers: *green pill*  ~red pill~  ^white pill^  | line break.
// Facts come from the site's blog posts (src/content/blog), which cite mitgaisim.idf.il.

// ---------- shared scene makers ----------
const hook = ({ photo, photoOpts, kick, text, size = 150, y = 560, sub, subY = 1080 }) => ({
  dur: 2.5,
  build: (H) => [
    photo ? H.photo(photo, photoOpts) : H.color("#0b0f0a", "#07090b"),
    kick ? H.rise(Object.assign(H.el("div", `top:420px`, null, kick), { className: "kick" }), 0, 0, null) : null,
    H.words(text, { y, size, at: -0.3, stagger: 0.17 }),
    sub ? H.words(sub, { y: subY, size: 58, at: 1.2, stagger: 0.07, kind: "rise" }) : null,
  ],
});

const outro = ({ text, sub = "kachkivun.com", size = 104, bg = ["#0d140a", "#07090b"] }) => ({
  dur: 3.5,
  build: (H) => {
    const url = H.el("div", "position:absolute;left:0;right:0;top:1130px;text-align:center", null,
      `<span style="display:inline-flex;align-items:center;gap:18px;background:var(--g);color:#0b1004;font-weight:900;font-size:56px;padding:26px 56px;border-radius:26px;box-shadow:0 14px 50px oklch(0.82 0.16 128/.35)">התחילו בחינם ←</span>
       <div class="mono" style="margin-top:28px;font-size:44px;direction:ltr;color:#e6eaee">${sub}</div>
       <div style="margin-top:14px;font-size:26px;color:var(--mut)">המלצות לא רשמיות. האתר אינו קשור לצה״ל.</div>`);
    return [H.color(...bg), H.words(text, { y: 520, size, at: 0.05, stagger: 0.14 }), H.rise(url, 1.3, 90, "pop")];
  },
});

// stereotype vs reality: unit slams in, the joke appears, gets stamped, the real fact slides up
const unit = ({ name, joke, fact, photo, photoOpts, bg }) => ({
  dur: 4.5,
  build: (H) => {
    const title = H.el("div", "position:absolute;left:0;right:0;top:400px;text-align:center;font-size:170px;font-weight:900;text-shadow:0 8px 40px rgba(0,0,0,.8)", null, name);
    const jokeBox = H.el("div", "top:690px"); jokeBox.className = "box";
    jokeBox.innerHTML = `<div class="lab">הבדיחה</div><div class="txt" style="font-size:66px">״${joke}״</div>`;
    const stamp = H.el("div", "left:250px;top:640px", null, "סטריאוטיפ"); stamp.className = "stamp"; stamp.dataset.rot = -8;
    const factBox = H.el("div", "top:960px"); factBox.className = "box fact";
    factBox.innerHTML = `<div class="lab">בפועל</div><div class="txt">${fact}</div>`;
    return [
      photo ? H.photo(photo, photoOpts) : H.color(...bg),
      H.slam(title, 0, { from: 1.8, flash: 0, shake: 14 }),
      H.rise(jokeBox, 0.5, 60, "whoosh"),
      H.slam(stamp, 1.75, { from: 2.6, flash: 0.25, shake: 30, sfx: "stamp" }),
      (t) => { jokeBox.style.filter = `grayscale(${pr(t, 1.75, 2.0)}) brightness(${1 - 0.35 * pr(t, 1.75, 2.0)})`; },
      H.rise(factBox, 2.25, 140, "chime"),
    ];
  },
});

// guess the role: 3 hints on the beat, a 3-2-1 ring, then the answer slams in
const guess = ({ hints, answer, sub, photo }) => ({
  dur: 5.5,
  build: (H) => {
    const q = H.el("div", "top:400px", null, "מי אני?"); q.className = "kick"; q.style.fontSize = "64px";
    const rows = hints.map((h, i) => {
      const r = H.el("div", `top:${520 + i * 165}px;display:flex;align-items:center;gap:26px;padding:30px 40px`, null,
        `<span class="mono" style="color:var(--g);font-size:44px">0${i + 1}</span><span style="font-size:52px;font-weight:800">${h}</span>`);
      r.className = "box"; return r;
    });
    const ring = H.el("div", "position:absolute;left:390px;top:1030px;width:300px;height:300px");
    ring.innerHTML = `<svg viewBox="0 0 100 100" width="300" height="300"><circle cx="50" cy="50" r="44" fill="rgba(7,9,11,.7)" stroke="rgba(255,255,255,.15)" stroke-width="6"/><circle id="arc" cx="50" cy="50" r="44" fill="none" stroke="var(--g)" stroke-width="6" stroke-linecap="round" stroke-dasharray="276.5" transform="rotate(-90 50 50)"/></svg><div class="mono" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:130px">3</div>`;
    const arc = ring.querySelector("#arc"), num = ring.querySelector(".mono");
    const ans = H.el("div", "position:absolute;left:0;right:0;top:1040px;text-align:center", null,
      `<span class="pill" style="font-size:120px;font-weight:900;padding:0 50px">${answer}</span>${sub ? `<div style="margin-top:26px;font-size:46px;font-weight:700;text-shadow:0 2px 10px #000">${sub}</div>` : ""}`);
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

// VS stat round: label + two values that punch in from each side
const vsRound = ({ label, a, b, bars }) => ({
  dur: 2.5,
  build: (H, S) => {
    const [tl, ta, tb] = S.vo && S.vo.length >= 3 ? S.vo : [0.05, 0.5, 1.0];
    const bg = H.color("#0b0d10", "#07090b");
    const split = H.el("div", "position:absolute;inset:0", null,
      `<div style="position:absolute;top:0;bottom:0;right:0;width:50%;background:linear-gradient(180deg,rgba(20,36,12,.95),rgba(7,9,11,.95))"></div>
       <div style="position:absolute;top:0;bottom:0;left:0;width:50%;background:linear-gradient(180deg,rgba(12,22,38,.95),rgba(7,9,11,.95))"></div>
       <div style="position:absolute;top:0;bottom:0;left:539px;width:2px;background:rgba(255,255,255,.15)"></div>
       <div style="position:absolute;top:420px;right:0;width:50%;text-align:center;font-size:48px;font-weight:900;color:var(--g)">סיירת מטכ״ל</div>
       <div style="position:absolute;top:420px;left:0;width:50%;text-align:center;font-size:48px;font-weight:900;color:#8ec5ff">שייטת 13</div>`);
    const lab = H.el("div", "position:absolute;left:0;right:0;top:560px;text-align:center", null, `<span class="pill white" style="font-size:64px;font-weight:900">${label}</span>`);
    const va = H.el("div", "position:absolute;right:40px;width:460px;top:760px;text-align:center;font-size:76px;font-weight:900;line-height:1.1", null, a);
    const vb = H.el("div", "position:absolute;left:40px;width:460px;top:760px;text-align:center;font-size:76px;font-weight:900;line-height:1.1", null, b);
    const ups = [bg, H.slam(lab, tl, { from: 1.6, flash: 0, shake: 0, sfx: "pop" }), H.slideX(va, ta, 500, "slam"), H.slideX(vb, tb, -500, "slam")];
    if (bars) {
      const mk = (side, color) => H.el("div", `position:absolute;${side}:70px;top:1010px;width:400px;height:40px;border-radius:20px;background:rgba(255,255,255,.1);overflow:hidden`, null, `<div style="height:100%;width:0;background:${color};border-radius:20px"></div>`);
      const ba = mk("right", "var(--g)"), bb = mk("left", "#8ec5ff");
      ups.push((t) => { ba.firstChild.style.width = `${bars[0] * eo(pr(t, ta + 0.1, ta + 0.8)) * 100}%`; bb.firstChild.style.width = `${bars[1] * eo(pr(t, tb + 0.1, tb + 0.8)) * 100}%`; ba.style.opacity = pr(t, ta, ta + 0.1); bb.style.opacity = pr(t, tb, tb + 0.1); });
    }
    return ups;
  },
});

// this-or-that round for open vs closed base: question on top, two answers stacked
const torRound = ({ q, open, closed }) => ({
  dur: 2.5,
  build: (H) => {
    const bg = H.el("div", "position:absolute;inset:0", null,
      `<div style="position:absolute;left:0;right:0;top:0;height:50%;background:linear-gradient(180deg,#132a0e,#0b1408)"></div>
       <div style="position:absolute;left:0;right:0;bottom:0;height:50%;background:linear-gradient(0deg,#0c1626,#0a111b)"></div>`);
    const qn = H.el("div", "position:absolute;left:0;right:0;top:330px;text-align:center", null, `<span class="pill white" style="font-size:62px;font-weight:900">${q}</span>`);
    const a = H.el("div", "position:absolute;left:80px;right:80px;top:560px;text-align:center", null, `<div style="font-size:40px;font-weight:800;color:var(--g)">פתוח</div><div style="font-size:92px;font-weight:900;line-height:1.1">${open}</div>`);
    const b = H.el("div", "position:absolute;left:80px;right:80px;top:1000px;text-align:center", null, `<div style="font-size:40px;font-weight:800;color:#8ec5ff">סגור</div><div style="font-size:92px;font-weight:900;line-height:1.1">${closed}</div>`);
    return [() => {}, H.slam(qn, 0.05, { from: 1.5, flash: 0, shake: 0, sfx: "pop" }), H.slideX(a, 0.5, 700, "slam"), H.slideX(b, 1.1, -700, "slam")];
  },
});

// one intelligence track: name slams, what you do, the requirement, then a note (green) or warning (red). Synced to up to 3 voice lines.
const track = ({ n, name, what, req, note, warn, photo }) => ({
  dur: 5.0,
  build: (H, S) => {
    const [t1, t2, t3] = S.vo ? [S.vo[0], S.vo[1] ?? S.vo[0] + 1.2, S.vo[2] ?? S.vo[0] + 2.4] : [0.35, 1.5, 2.7];
    const k = H.el("div", "top:400px", null, `מסלול ${n} מתוך 4`); k.className = "kick";
    const nm = H.el("div", "position:absolute;left:0;right:0;top:470px;text-align:center", null, `<span class="pill" style="font-size:118px;font-weight:900;padding:0 44px">${name}</span>`);
    const w = H.el("div", "top:690px"); w.className = "box"; w.innerHTML = `<div class="lab">מה עושים</div><div class="txt" style="font-size:52px">${what}</div>`;
    const r = H.el("div", "position:absolute;left:80px;right:80px;top:960px;text-align:center;font-size:58px;font-weight:900;line-height:1.25;text-shadow:0 4px 20px #000", null, req);
    const x = note || warn ? H.el("div", "top:1110px") : null;
    if (x) { x.className = "box" + (warn ? "" : " fact"); if (warn) x.style.borderColor = "var(--red)"; x.innerHTML = `<div class="txt" style="font-size:46px">${warn ? "⚠️ " : ""}${warn || note}</div>`; }
    return [photo ? H.photo(photo, { dark: 0.78, pos: "70% center" }) : H.color("#08100c", "#07090b"), H.rise(k, 0, 0, null),
      H.slam(nm, 0.05, { from: 2, flash: 0, shake: 14 }), H.rise(w, t1 + 0.2, 70), H.slam(r, t2, { from: 1.5, flash: 0, shake: 0, sfx: "pop" }), x ? H.rise(x, t3, 90, warn ? "stamp" : "chime") : null];
  },
});

// titled list: rows punch in one by one (synced to voice lines 1..n when there is a voice; line 0 is the title)
const list = ({ title, items, tone = "good", dur = 5.0, bg = ["#0b120a", "#07090b"], icons }) => ({
  dur,
  build: (H, S) => {
    const times = S.vo && S.vo.length > items.length ? S.vo.slice(1) : items.map((_, i) => 0.7 + i * 1.2);
    const icon = (i) => (icons ? icons[i] : tone === "good" ? "✓" : "✕");
    const col = tone === "good" ? "var(--g)" : "var(--red)";
    const rows = items.map((it, i) => {
      const r = H.el("div", `top:${620 + i * 190}px;display:flex;align-items:center;gap:30px;padding:30px 40px`, null,
        `<span style="width:76px;height:76px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:900;background:${col};color:#0b0d10">${icon(i)}</span><span style="font-size:52px;font-weight:800;line-height:1.2">${it}</span>`);
      r.className = "box"; return r;
    });
    return [H.color(...bg), H.words(title, { y: 400, size: 104, at: 0 }), ...rows.map((r, i) => H.slideX(r, times[i], -700, "pop"))];
  },
});

// ---------- the reels ----------
const REELS = {
  // 1. Tag-a-friend stereotypes. Sends drive reach to non-followers.
  stereotypes: {
    scenes: [
      hook({ photo: "slide-7", photoOpts: { dark: 0.6 }, kick: "סטריאוטיפ מול מציאות", text: "איזה סוג בן אדם | אתה *לפי* *היחידה?*", size: 140, y: 560 }),
      unit({ name: "מ״צ", joke: "המלשינים של הצבא", fact: "שומרים על <span class='g'>החוסן המוסרי</span> של צה״ל", bg: ["#1a0f24", "#07090b"] }),
      unit({ name: "חיל האוויר", joke: "מפונקים, לא נרדמים בלי שמיכי", fact: "בקרה אווירית: <span class='g'>משמרות וכוננות</span> באמצע הלילה", photo: "slide-10", photoOpts: { dark: 0.7 } }),
      unit({ name: "גולני", joke: "גברים על", fact: "4 חודשי טירונות + 3 חודשי אימון מתקדם. <span class='g'>פרופיל 82+</span>", photo: "slide-6", photoOpts: { dark: 0.65, pos: "70% center" } }),
      unit({ name: "טבח", joke: "שולט בבסיס בגלל השניצל", fact: "נחשב <span class='g'>ניסיון לתעודת שף</span> אזרחי", bg: ["#2a170a", "#07090b"] }),
      outro({ text: "תייגו את החבר | שלכם ב*מ״צ* 😂" }),
    ],
  },

  // 2. Navy guess-the-role quiz. Comments ("how many did you get?") and sends.
  navy: {
    scenes: [
      hook({ photo: "slide-4", photoOpts: { dark: 0.5 }, kick: "חיל הים", text: "נחשו את *התפקיד* | ב־3 רמזים", size: 140, sub: "כמה תצליחו? 👀" }),
      guess({ hints: ["הקצינים של זרוע הים", "קורס של כשנתיים וחצי", "תואר מאוניברסיטת חיפה"], answer: "חובל/ת", photo: "slide-4" }),
      guess({ hints: ["עובדת מחדר שליטה", "מנטרת תנועת כלי שיט", "מזהה חריגים ומתריעה"], answer: "בק״שית", sub: "בקרית שליטה ימית" }),
      guess({ hints: ["חלק מצוות הצוללת", "פרופיל 82 · דפ״ר 60", "בנים בלבד"], answer: "צוללן", photo: "slide-4" }),
      outro({ text: "כמה ניחשתם? | *תכתבו* בתגובות", size: 100, bg: ["#0a1422", "#07090b"] }),
    ],
  },

  // 3. Intelligence, exactly as the source video lays it out. Voiced (audio/intel.json).
  intel: {
    scenes: [
      hook({ photo: "slide-6", photoOpts: { dark: 0.6, pos: "70% center" }, kick: "חיל המודיעין", text: "רוצים *מודיעין?*", size: 170, y: 540, sub: "4 מסלולי מיון. ולכל אחד *דפ״ר* אחר", subY: 1080 }),
      {
        dur: 6.5,
        build: (H, S) => {
          const bg = H.color("#08100c", "#07090b");
          const title = H.el("div", "top:390px", null, "כמה דפ״ר צריך?"); title.className = "kick"; title.style.fontSize = "60px"; title.style.color = "#fff";
          const Y = (d) => 1240 - ((d - 10) / 80) * 720;
          const trackEl = H.el("div", "position:absolute;left:180px;top:520px;width:70px;height:720px;border-radius:35px;background:rgba(255,255,255,.08);border:2px solid var(--line);overflow:hidden", null, '<div style="position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,var(--gd),var(--g));border-radius:35px"></div>');
          const fill = trackEl.firstChild;
          const val = H.el("div", "position:absolute;left:40px;width:120px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:60px;color:var(--g);text-shadow:0 2px 12px #000");
          const marks = [[50, "ערבית", "50+", "מגמת ערבית", 1060], [60, "גאמ״א", "60+", "תפקידי הסייבר", 870], [60, "כלל חמ״ן", "60+", "4 יח״ל מתמטיקה + ריאלית", 680], [90, "שחקים", "90", "9 מסלולים", 490]];
          const at = S.vo && S.vo.length >= 4 ? S.vo.map((v) => v + 0.1) : [1.4, 2.4, 3.3, 4.6];
          const labs = marks.map(([d, n, num, sub, slot]) => H.el("div", `position:absolute;right:80px;left:300px;top:${slot}px;text-align:right`, null,
            `<div style="font-size:${d === 90 ? 76 : 62}px;font-weight:900;line-height:1.05">${d === 90 ? `<span class="pill">${n}</span>` : n} <span class="mono" style="font-size:44px;color:var(--g);direction:ltr;unicode-bidi:isolate">${num}</span></div><div style="font-size:34px;color:var(--mut);font-weight:700">${sub}</div>`));
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
      track({ n: 1, name: "שחקים", what: "9 מסלולים בחיל המודיעין", req: "דפ״ר <span class='g'>90</span>", warn: "לא כל מי שקיבל 90 מזומן. רק האחוזון העליון.", photo: "slide-6" }),
      track({ n: 2, name: "גאמ״א", what: "תפקידי הסייבר בכל יחידות המודיעין, בצבא ובשירותי הביטחון", req: "דפ״ר <span class='g'>60+</span>", note: "סיימתם מגמת מחשבים? זה המסלול בשבילכם 💻" }),
      track({ n: 3, name: "ערבית", what: "האזנות, מחקר ומודיעין בשפה הערבית", req: "דפ״ר <span class='g'>50+</span> · מגמת ערבית" }),
      track({ n: 4, name: "כלל חמ״ן", what: "שפות, אמל״ח, פענוח ומחקר, בכל יחידות המודיעין", req: "דפ״ר <span class='g'>60+</span> · 4 יח״ל מתמטיקה · מגמה ריאלית", warn: "התמיינתם לערבית או לשחקים? לכלל חמ״ן כבר אי אפשר." }),
      outro({ text: "שלחו למי | שחולם על *מודיעין* 🎯", size: 100 }),
    ],
  },

  // 4. Open vs closed base: the source video's pros and cons of daily service, then a comment poll.
  base: {
    scenes: [
      {
        dur: 2.5,
        build: (H) => {
          const top = H.el("div", "position:absolute;left:0;right:0;top:0;height:50%;background:linear-gradient(180deg,#183a10,#0d1a09)");
          const bot = H.el("div", "position:absolute;left:0;right:0;bottom:0;height:50%;background:linear-gradient(0deg,#0d1d33,#0a1220)");
          const vs = H.el("div", "position:absolute;left:0;right:0;top:880px;text-align:center", null, '<span class="pill white" style="font-size:90px;font-weight:900">או</span>');
          return [
            (t) => { top.style.transform = `translateX(${(1 - eo5(pr(t, -0.3, 0.3))) * 1080}px)`; bot.style.transform = `translateX(${(1 - eo5(pr(t, -0.2, 0.4))) * -1080}px)`; },
            H.words("בסיס *פתוח*", { y: 480, size: 150, at: -0.3 }),
            H.slam(vs, 0.5, { from: 2, flash: 0.3, shake: 18 }),
            H.words("בסיס *סגור?*", { y: 1080, size: 150, at: 0.9 }),
          ];
        },
      },
      torRound({ q: "איפה ישנים?", open: "בבית, כל לילה", closed: "בבסיס" }),
      list({ title: "יומיות: *היתרונות*", items: ["בבית כל יום: המיטה, האוכל, המקלחת", "ממשיכים לימודים או עבודה בצד", "ג׳וב טוב? בדרך הביתה כבר ב־12:30"], dur: 5.5 }),
      list({ title: "יומיות: ~החסרונות~", tone: "bad", bg: ["#1a0d0d", "#07090b"], items: ["שעה וחצי עד שעתיים נסיעה לכל כיוון", "לפעמים נשארים עד 17:00 או 18:00", "חוזרים ב־19:00 והיום נגמר"], dur: 5.5 }),
      torRound({ q: "החבר׳ה", open: "כולם רצים הביתה", closed: "אווירה משפחתית" }),
      {
        dur: 3.5,
        build: (H) => [H.photo("dune", { dark: 0.65 }),
          H.words("שעה וחצי | לכל כיוון", { y: 470, size: 120, at: 0 }),
          H.words("= *3* *שעות* | ביום בדרכים", { y: 840, size: 110, at: 1.0 }),
          H.words("תעשו את החשבון *לפני* השאלון", { y: 1180, size: 52, at: 2.2, stagger: 0.05, kind: "rise" })],
      },
      outro({ text: "פתוח או סגור? | *תכתבו* בתגובות 👇", size: 98 }),
    ],
  },

  // 5. Matkal vs Shayetet 13: fighting-game VS screen with stat rounds.
  matkal: {
    scenes: [
      {
        dur: 3.0,
        build: (H) => {
          const L = H.el("div", "position:absolute;top:0;bottom:0;right:0;width:50%;overflow:hidden", null, `<div style="position:absolute;inset:0 -300px;background:url('${IMG["slide-6"]}') 70% center/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,30,5,.55),rgba(7,9,11,.9))"></div>`);
          const R = H.el("div", "position:absolute;top:0;bottom:0;left:0;width:50%;overflow:hidden", null, `<div style="position:absolute;inset:0 -300px;background:url('${IMG["slide-4"]}') 30% center/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,15,35,.55),rgba(7,9,11,.9))"></div>`);
          H.el("div", "position:absolute;top:0;bottom:0;left:536px;width:8px;background:#fff;box-shadow:0 0 40px #fff");
          const n1 = H.el("div", "position:absolute;right:30px;width:480px;top:620px;text-align:center;font-size:96px;font-weight:900;line-height:1.02;text-shadow:0 6px 30px #000", null, 'סיירת<br><span class="g">מטכ״ל</span>');
          const n2 = H.el("div", "position:absolute;left:30px;width:480px;top:620px;text-align:center;font-size:96px;font-weight:900;line-height:1.02;text-shadow:0 6px 30px #000", null, 'שייטת<br><span style="color:#8ec5ff">13</span>');
          const vs = H.el("div", "position:absolute;left:0;right:0;top:930px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:200px;font-weight:800;font-style:italic;color:#fff;text-shadow:0 0 50px rgba(255,255,255,.5),0 10px 30px #000", null, "VS");
          return [
            (t) => { L.style.transform = `translateX(${(1 - eo5(pr(t, -0.2, 0.35))) * 600}px)`; R.style.transform = `translateX(${(1 - eo5(pr(t, -0.1, 0.45))) * -600}px)`; },
            H.slideX(n1, 0.0, 500, null), H.slideX(n2, 0.25, -500, null),
            H.slam(vs, 0.75, { from: 3, flash: 0.7, shake: 36, sfx: "reveal" }),
          ];
        },
      },
      vsRound({ label: "הכשרה", a: "16<br><span style='font-size:44px'>חודשים</span>", b: "20<br><span style='font-size:44px'>חודשים</span>", bars: [0.8, 1.0] }),
      vsRound({ label: "גיבוש", a: "אחוד<br><span style='font-size:44px'>עם שלדג</span>", b: "5 ימים<br><span style='font-size:44px'>ים ויבשה</span>" }),
      vsRound({ label: "שירות", a: "חובה<br><span style='font-size:44px'>+ 3 שנות קבע</span>", b: "36 ח׳<br><span style='font-size:44px'>מתום ההכשרה</span>" }),
      vsRound({ label: "בסוף", a: "חסוי<br><span style='font-size:44px'>לחלוטין</span>", b: "כנפי<br><span style='font-size:44px'>העטלף</span>" }),
      {
        dur: 3.0,
        build: (H) => [H.photo("dawn", { dark: 0.55 }),
          H.words("אותה דלת | לשתיהן:", { y: 470, size: 110 }),
          H.words("*יום* *סיירות*", { y: 760, size: 130, at: 0.8 }),
          H.words("פרופיל 82+ · דפ״ר 50+", { y: 1010, size: 62, at: 1.6, stagger: 0.08, kind: "rise" })],
      },
      outro({ text: "ואתם? *מטכ״ל* | או *שייטת?* 👇", size: 104 }),
    ],
  },

  // 6. POV: the placement you didn't want. Practical steps, ends with "send to a friend before the questionnaire".
  placement: {
    scenes: [
      {
        dur: 3.0,
        build: (H) => {
          const n = H.el("div", "position:absolute;left:90px;right:90px;top:620px;border-radius:44px;background:rgba(245,247,250,.96);color:#0b0d10;padding:34px 40px;box-shadow:0 30px 80px rgba(0,0,0,.6);display:flex;gap:28px;align-items:center", null,
            `<div style="width:110px;height:110px;border-radius:28px;background:#0b0d10;display:flex;align-items:center;justify-content:center;font-size:64px;flex:none">🔔</div>
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
          H.words("ו... זה | ~לא~ מה שרציתם", { y: 600, size: 130 }),
          H.words("😶", { y: 1020, size: 170, at: 0.9 })],
      },
      list({ title: "איך נקבע *השיבוץ?*", items: ["צרכי הצבא", "הנתונים שלכם: צו ראשון ויום המא״ה", "הדירוגים שלכם בשאלון ההעדפות"], icons: ["1", "2", "3"], dur: 5.0 }),
      ...[["להכיר את התפקיד", "הרבה פעמים ״לא רציתי״ זה ״לא הכרתי״"], ["לפנות למיטב", "האזור האישי באתר מתגייסים או 1111"], ["ביום הגיוס", "לבקש לדבר עם קצין/ת מיון"]].map(([h, s], i) => ({
        dur: 2.5,
        build: (H, S) => {
          const [th, ts] = S.vo ? [S.vo[0] + 0.1, S.vo[1] ?? S.vo[0] + 1] : [0.45, 1.1];
          const num = H.el("div", "position:absolute;left:0;right:0;top:400px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:260px;font-weight:800;color:var(--g);text-shadow:0 0 60px oklch(0.82 0.16 128/.4)", null, String(i + 1));
          const sub = H.el("div", "position:absolute;left:90px;right:90px;top:1000px;text-align:center;font-size:54px;font-weight:700;color:#d7dce2;line-height:1.3", null, s);
          return [H.color("#0b120a", "#07090b"), H.slam(num, 0, { from: 1.8, flash: 0, shake: 16 }), H.words(h, { y: 760, size: 100, at: th }), H.rise(sub, ts, 60, "whoosh")];
        },
      })),
      {
        dur: 3.0,
        build: (H) => [H.color("#0d140a", "#07090b"),
          H.words("הכי חשוב: | *שאלון* *ההעדפות*", { y: 520, size: 120 }),
          H.words("שם זה נקבע. תגיעו עם רשימה מוכנה.", { y: 960, size: 56, at: 1.2, stagger: 0.06, kind: "rise" })],
      },
      outro({ text: "שלחו לחבר | *לפני* השאלון 📩", size: 104 }),
    ],
  },
};
