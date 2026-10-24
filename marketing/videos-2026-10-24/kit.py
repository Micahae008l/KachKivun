"""Shared render kit for the 2026-10-24 video batch. Reuses the look of ../posts/build.py (same CSS, logo, page()).
    from kit import slides, stories, clip, slideshow
Needs Google Chrome. ffmpeg comes from imageio_ffmpeg.
"""
import pathlib, subprocess, tempfile, glob
import imageio_ffmpeg

HERE = pathlib.Path(__file__).resolve().parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
MUSIC = HERE.parent / "ig-launch" / "reel" / "reel-music.mp4"
SOURCES = sorted(glob.glob(r"C:\Users\Michael\Downloads\WhatsApp Video 2026-10-24 at *.mp4"))  # v1..v7 in this order

# ponytail: pulls CSS/LOGO/helpers/page() straight out of posts/build.py so the look has one source; breaks if build.py is restructured
_src = (HERE.parent / "posts" / "build.py").read_text(encoding="utf-8")
_ns = {"__file__": str(HERE.parent / "posts" / "build.py")}
exec(_src[: _src.index("POSTS = {")], _ns)
exec(_src[_src.index("def page("): _src.index("import sys\nonly")], _ns)
CSS, LOGO, CHROME, page = _ns["CSS"], _ns["LOGO"], _ns["CHROME"], _ns["page"]
cta, step, tile, DISCLAIMER = _ns["cta"], _ns["step"], _ns["tile"], _ns["DISCLAIMER"]

OVERLAY_CSS = """
html,body{background:transparent!important}
.ov{position:absolute;left:70px;right:70px;text-align:center}
.ov.top{top:220px}.ov.mid{top:50%;transform:translateY(-50%)}.ov.bottom{bottom:430px}
.ov b{display:inline;font-weight:900;font-size:68px;line-height:1.35;padding:6px 22px;background:oklch(0.10 0.006 260/.88);
  box-decoration-break:clone;-webkit-box-decoration-break:clone;border-radius:14px}
.ov b em{color:oklch(0.80 0.14 128)}
.ov.small b{font-size:46px}
.tag{position:absolute;top:96px;right:70px;display:flex;align-items:center;gap:12px;font-weight:800;font-size:32px;
  background:oklch(0.10 0.006 260/.8);padding:10px 22px;border-radius:999px}
.tag svg{width:34px;height:32px}
"""


def _shot(html, png, w, h, transparent=False):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8", dir=HERE) as f:
        f.write(html)
    src = pathlib.Path(f.name)
    args = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
            "--allow-file-access-from-files", "--virtual-time-budget=8000", f"--window-size={w},{h}", f"--screenshot={pathlib.Path(png).resolve()}"]
    if transparent:
        args.append("--default-background-color=00000000")
    subprocess.run(args + [src.as_uri()], check=True, capture_output=True, timeout=120)
    src.unlink()


def slides(outdir, items, sizes=("ig", "tt")):
    """items: list of (photo, pos, html) exactly like POSTS in posts/build.py. photo: None, "topo", or a hero-slideshow number with a credit.
    Writes outdir/ig/N.png (1080x1350) and outdir/tt/N.png (1080x1920). Returns the tt paths."""
    out = []
    for size in sizes:
        w, h = _ns["SIZES"][size]
        d = pathlib.Path(outdir) / size
        d.mkdir(parents=True, exist_ok=True)
        for i, (photo, pos, html) in enumerate(items):
            png = d / f"{i + 1}.png"
            _shot(page(size, photo, pos, html, i, len(items)), png, w, h)
            if size == "tt":
                out.append(png)
    return out


def stories(outdir, items):
    """Story frames, 1080x1920. items like slides(). Leave the middle-lower area free where you will place the sticker."""
    return slides(outdir, items, sizes=("tt",))


def overlay_png(html, png):
    """Transparent 1080x1920 overlay. html uses <div class="ov top|mid|bottom [small]"><b>text <em>accent</em></b></div>; a brand tag is added."""
    tag = f'<div class="tag">{LOGO}קח כיוון</div>'
    doc = (f'<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>{CSS}{OVERLAY_CSS}</style>'
           f'<body style="--h:1920px">{tag}{html}</body></html>')
    _shot(doc, png, 1080, 1920, transparent=True)


def _endcard(png, title="לאיזה תפקיד אתם מתאימים?", label="התחילו בחינם"):
    html = f'<div class="kicker">קח כיוון</div><h2>{title}</h2><div class="ctarow">{cta(label)}</div>{DISCLAIMER}'
    _shot(page("tt", None, "", html, 0, 1), png, 1080, 1920)


def clip(video_no, start, end, overlay_html, out_mp4, endcard_title=None, endcard_label="התחילו בחינם"):
    """Cut seconds [start,end] from source video v{video_no}, upscale to 1080x1920, burn the overlay, append a 2.5s end card."""
    out_mp4 = pathlib.Path(out_mp4)
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    ov, ec = out_mp4.with_suffix(".ov.png"), out_mp4.with_suffix(".end.png")
    overlay_png(overlay_html, ov)
    _endcard(ec, endcard_title or "לאיזה תפקיד אתם מתאימים?", endcard_label)
    fc = (f"[0:v]trim={start}:{end},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[bg];"
          f"[bg][1:v]overlay=0:0[v0];[0:a]atrim={start}:{end},asetpts=PTS-STARTPTS,aresample=44100[a0];"
          f"[2:v]scale=1080:1920,fps=30,setsar=1,format=yuv420p[v1];[3:a]aresample=44100[a1];"
          f"[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", SOURCES[video_no - 1], "-i", str(ov),
                    "-loop", "1", "-t", "2.5", "-i", str(ec),
                    "-f", "lavfi", "-t", "2.5", "-i", "anullsrc=r=44100:cl=stereo",
                    "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", str(out_mp4)], check=True)
    ov.unlink(); ec.unlink()
    return out_mp4


def slideshow(pngs, out_mp4, secs=3.0):
    """Turn 1080x1920 slide PNGs into a music video (TikTok/Reel), crossfade between slides, music from the launch reel."""
    pngs = [str(p) for p in pngs]
    n, fade = len(pngs), 0.4
    inputs = sum((["-loop", "1", "-t", str(secs + fade), "-i", p] for p in pngs), [])
    fc, last = "", "[0:v]"
    for i in range(1, n):
        fc += f"{last}[{i}:v]xfade=transition=fade:duration={fade}:offset={i * secs}[x{i}];"
        last = f"[x{i}]"
    total = n * secs + fade
    fc += f"{last}format=yuv420p,fps=30[v];[{n}:a]atrim=0:{total},afade=t=out:st={total - 1.2}:d=1.2[a]"
    pathlib.Path(out_mp4).parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-y", "-loglevel", "error", *inputs, "-i", str(MUSIC), "-filter_complex", fc,
                    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", "-shortest", str(out_mp4)], check=True)
    return out_mp4
