"""Gera a narração (edge-tts) e os tempos de cada palavra para o Remotion.

Uso: .venv\\Scripts\\python tools\\narrate.py
Saída: public/narration/<id>.mp3 e src/narration.json
"""
import asyncio
import json
from pathlib import Path

import edge_tts

VOICE = "pt-BR-AntonioNeural"
RATE = "-6%"

# Um trecho por cena. Edite o texto aqui e rode o script de novo.
SEGMENTS = [
    ("caminho", "No Caminho da Fé, cada passo é uma oração."),
    ("estrada", "São quilômetros de estrada, sol e poeira. E quem caminha sabe: água fresca faz toda a diferença."),
    ("garrafa", "Conheça a garrafa térmica Porteira do Céu."),
    ("beneficios", "São seiscentos mililitros que mantêm sua água geladinha, com mosquetão pra prender na mochila."),
    ("arte", "E uma arte exclusiva, com a Porteira do Céu e Nossa Senhora Aparecida."),
    ("cta", "Agora você encontra na Porteira do Céu. A sua companheira no Caminho da Fé."),
]

ROOT = Path(__file__).resolve().parent.parent
OUT_AUDIO = ROOT / "public" / "narration"
OUT_JSON = ROOT / "src" / "narration.json"


async def synth(seg_id: str, text: str) -> dict:
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    words = []
    path = OUT_AUDIO / f"{seg_id}.mp3"
    with open(path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 10_000  # 100ns -> ms
                words.append({"text": chunk["text"], "startMs": round(start), "endMs": round(start + chunk["duration"] / 10_000)})
    return {"id": seg_id, "text": text, "file": f"narration/{seg_id}.mp3", "durationMs": words[-1]["endMs"], "words": words}


async def main() -> None:
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    result = [await synth(i, t) for i, t in SEGMENTS]
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for s in result:
        print(f"{s['id']:<11} {s['durationMs'] / 1000:5.2f}s  {len(s['words'])} palavras")


asyncio.run(main())
