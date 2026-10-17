"""Gera a narração (edge-tts) e os tempos de cada palavra para o Remotion.

Uso: .venv\\Scripts\\python tools\\narrate.py [narrado|v3]
Saída: public/<pasta>/<id>.mp3 e src/<json>
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

VOICE = "pt-BR-AntonioNeural"
RATE = "-6%"

# Um trecho por cena. Edite o texto aqui e rode o script de novo.
NARRADO = [
    ("caminho", "No Caminho da Fé, cada passo é uma oração."),
    ("estrada", "São quilômetros de estrada, sol e poeira. E quem caminha sabe: água fresca faz toda a diferença."),
    ("garrafa", "Conheça a garrafa térmica Porteira do Céu."),
    ("beneficios", "São seiscentos mililitros que mantêm sua água geladinha, com mosquetão pra prender na mochila."),
    ("arte", "E uma arte exclusiva, com a Porteira do Céu e Nossa Senhora Aparecida."),
    ("cta", "Agora você encontra na Porteira do Céu. A sua companheira no Caminho da Fé."),
]

V3 = [
    ("hook", "Você caminha com fé. Não com sede."),
    ("marca", "Conheça a garrafa térmica Porteira do Céu."),
    ("caminho", "No Caminho da Fé, cada passo é uma oração. E a água fresquinha vai junto, presa na mochila."),
    ("arte", "A arte é exclusiva: a Porteira do Céu e Nossa Senhora Aparecida, em volta da garrafa inteira."),
    ("recursos", "Seiscentos mililitros, térmica, com mosquetão e bico esportivo. Tudo que o Caminho pede."),
    ("cta", "Agora na Porteira do Céu. Garanta a sua."),
]

VARIANT = sys.argv[1] if len(sys.argv) > 1 else "narrado"
SEGMENTS, AUDIO_DIR, JSON_NAME = {
    "narrado": (NARRADO, "narration", "narration.json"),
    "v3": (V3, "v3/narration", "v3/narration.json"),
}[VARIANT]

ROOT = Path(__file__).resolve().parent.parent
OUT_AUDIO = ROOT / "public" / AUDIO_DIR
OUT_JSON = ROOT / "src" / JSON_NAME


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
    return {"id": seg_id, "text": text, "file": f"{AUDIO_DIR}/{seg_id}.mp3", "durationMs": words[-1]["endMs"], "words": words}


async def main() -> None:
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    result = [await synth(i, t) for i, t in SEGMENTS]
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for s in result:
        print(f"{s['id']:<11} {s['durationMs'] / 1000:5.2f}s  {len(s['words'])} palavras")


asyncio.run(main())
