"""Trilha original (sintetizada) para o vídeo v3: violão dedilhado + pad + baixo + sinos.

Uso: python tools/music.py [segundos]
Saída: public/v3/music.wav
"""
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 44100
BPM = 80
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 40.0
OUT = Path(__file__).resolve().parent.parent / "public" / "v3" / "music.wav"
rng = np.random.default_rng(7)

N = int(DUR * SR) + SR * 4
L = np.zeros(N)
R = np.zeros(N)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def add(sig: np.ndarray, t: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
    R[i : i + len(sig)] += sig * np.sqrt((1 + pan) / 2)


def pluck(midi: float, length: float = 2.6, bright: float = 0.6) -> np.ndarray:
    """Karplus-Strong: corda dedilhada."""
    f = hz(midi)
    p = int(SR / f)
    n = int(length * SR)
    burst = rng.uniform(-1, 1, p)
    burst = lfilter([bright, 1 - bright], [1], burst)  # palheta mais macia
    x = np.zeros(n)
    x[:p] = burst
    a = np.zeros(p + 2)
    a[0] = 1
    a[p] = a[p + 1] = -0.4985
    y = lfilter([1], a, x)
    env = np.minimum(1, np.arange(n) / (0.002 * SR))
    return y * env


def pad(midis: list[int], length: float) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in midis:
        for det in (-0.06, 0.0, 0.07):
            f = hz(m + det)
            s += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    att, rel = 1.4, 1.6
    env = np.minimum(1, t / att) * np.minimum(1, (length - t) / rel).clip(0)
    sos = butter(2, 1400, "low", fs=SR, output="sos")
    return sosfilt(sos, s * env) / (len(midis) * 3)


def bass(midi: int, length: float) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / 0.02) * np.exp(-t * 1.2)
    return s * env


def kick() -> np.ndarray:
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 46 + 70 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9)


def shaker() -> np.ndarray:
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    sos = butter(2, 6000, "high", fs=SR, output="sos")
    return sosfilt(sos, rng.uniform(-1, 1, n)) * np.exp(-t * 55)


def bell(midi: float, length: float = 3.0) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for a, r, d in [(1, 1, 1.6), (0.5, 2.0, 2.4), (0.25, 3.01, 3.5), (0.12, 4.2, 5)])
    return s * np.minimum(1, t / 0.004)


# Ré maior: D  A  Bm  G
CHORDS = [
    (50, [62, 66, 69], [50, 57, 62, 66, 69, 74, 69, 66]),
    (45, [61, 64, 69], [45, 52, 57, 61, 64, 69, 64, 61]),
    (47, [62, 66, 71], [47, 54, 59, 62, 66, 71, 66, 62]),
    (43, [62, 67, 71], [43, 50, 55, 59, 62, 67, 62, 59]),
]
MELODY = [[78, 76, 74], [76, 73, 69], [74, 78, 81], [79, 78, 74]]

bars = int(DUR // BAR)
last = bars - 1
for b in range(bars):
    root, triad, arp = CHORDS[b % 4]
    t0 = b * BAR
    if b == last:  # final: acorde de Ré dedilhado e deixado soar
        for k, m in enumerate([50, 57, 62, 66, 69, 74]):
            add(pluck(m, 5.0, 0.55), t0 + k * 0.045, 0.55, -0.3 + k * 0.12)
        add(pad([62, 66, 69], 5.5), t0, 0.5)
        add(bass(38, 4.5), t0, 0.5)
        add(bell(81, 5), t0 + 0.1, 0.12, 0.3)
        break
    add(pad(triad, BAR + 1.6), t0, 0.45 if b >= 4 else 0.32)
    for k, m in enumerate(arp):
        hum = rng.normal(0, 0.006)
        vel = 0.42 if k % 2 == 0 else 0.3
        add(pluck(m, 2.6, 0.5 + 0.2 * (k == 0)), t0 + k * BEAT / 2 + hum, vel, -0.35 if k % 2 else 0.25)
    if b >= 4:
        add(bass(root - 12, BAR), t0, 0.26)
        add(bass(root - 12, BAR / 2), t0 + 2 * BEAT, 0.17)
        for beat in (0, 2):
            add(kick(), t0 + beat * BEAT, 0.16)
    if b >= 8:
        for e in range(8):
            add(shaker(), t0 + e * BEAT / 2 + BEAT / 4, 0.09 if e % 2 else 0.05, 0.4)
        for k, m in enumerate(MELODY[b % 4]):
            add(bell(m), t0 + k * BEAT * 1.33, 0.11, 0.2)

# reverb simples por convolução com cauda de ruído
ir_len = int(2.2 * SR)
tt = np.arange(ir_len) / SR
irL = rng.normal(0, 1, ir_len) * np.exp(-tt * 3.0)
irR = rng.normal(0, 1, ir_len) * np.exp(-tt * 3.0)
sos = butter(1, 3500, "low", fs=SR, output="sos")
irL, irR = sosfilt(sos, irL), sosfilt(sos, irR)
wetL = fftconvolve(L, irL)[:N]
wetR = fftconvolve(R, irR)[:N]
wet_gain = 0.22 * np.max(np.abs(L)) / (np.max(np.abs(wetL)) + 1e-9)
L2 = L + wetL * wet_gain
R2 = R + wetR * wet_gain

n_out = int(DUR * SR)
mix = np.stack([L2, R2], axis=1)[:n_out]
fade = int(0.02 * SR)
mix[:fade] *= np.linspace(0, 1, fade)[:, None]
mix /= np.max(np.abs(mix)) / 0.89  # ~ -1 dBFS
OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"{OUT} ({DUR:.1f}s, {bars} compassos)")
