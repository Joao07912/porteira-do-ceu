"""Masteriza o áudio de um MP4 renderizado: sobe o volume até ~-15 dB RMS com limitador suave.

Uso: python tools/master.py out/video.mp4   (sobrescreve o arquivo)
"""
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

TARGET_RMS_DB = -15.0
CEILING = 0.94

src = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parent.parent
ffmpeg = ["npx", "remotion", "ffmpeg", "-v", "error", "-y"]

with tempfile.TemporaryDirectory() as tmp:
    raw = Path(tmp) / "raw.wav"
    mastered = Path(tmp) / "master.wav"
    out = Path(tmp) / "out.mp4"
    subprocess.run([*ffmpeg, "-i", str(src), "-vn", "-c:a", "pcm_s16le", str(raw)], check=True, cwd=root, shell=True)
    with wave.open(str(raw)) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, ch) / 32768

    # RMS só dos trechos com som (ignora silêncios)
    win = sr // 10
    blocks = a[: len(a) // win * win].reshape(-1, win, ch)
    rms = np.sqrt((blocks**2).mean(axis=(1, 2)))
    active = rms[rms > 10 ** (-45 / 20)]
    cur_db = 20 * np.log10(np.sqrt((active**2).mean()))
    gain = 10 ** ((TARGET_RMS_DB - cur_db) / 20)

    y = a * gain
    # limitador suave: linear até 0.6, depois curva tanh até o teto
    knee = 0.6
    mag = np.abs(y)
    over = mag > knee
    y[over] = np.sign(y[over]) * (knee + (CEILING - knee) * np.tanh((mag[over] - knee) / (CEILING - knee)))

    with wave.open(str(mastered), "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((y * 32767).astype("<i2").tobytes())
    subprocess.run(
        [*ffmpeg, "-i", str(src), "-i", str(mastered), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", str(out)],
        check=True,
        cwd=root,
        shell=True,
    )
    out.replace(src)
    print(f"{src.name}: {cur_db:.1f} dB -> {TARGET_RMS_DB} dB (ganho {20 * np.log10(gain):+.1f} dB)")
