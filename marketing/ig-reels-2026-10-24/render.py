"""Render reels: python render.py [id ...]   (no ids = all six). Output: out/<id>.mp4
Stills only: python render.py matkal --stills 1.5,6,10   -> stills/<id>-still-<t>.png
Needs Node 22+, Google Chrome, and `pip install -r requirements.txt`.
"""
import os, subprocess, sys
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
ALL = ["stereotypes", "navy", "matkal", "intel", "base", "placement"]
args = sys.argv[1:]
env = dict(os.environ)
if "--stills" in args:
    k = args.index("--stills"); env["STILLS"] = args[k + 1]; del args[k:k + 2]
subprocess.run(["node", os.path.join(HERE, "record.mjs"), imageio_ffmpeg.get_ffmpeg_exe(), *(args or ALL)], check=True, env=env, cwd=HERE)
