import narration from "./narration.json";

export const FPS = 30;
export const T = 18; // transição entre cenas (frames)
const LEAD = 0.45; // respiro antes da fala (s)
const TAIL = 0.6; // respiro depois da fala (s)
const EXTRA: Record<string, number> = { hook: 0.6, arte: 0.8, atelie: 0.7, cta: 2.8 };

export type SceneId = "hook" | "marca" | "caminho" | "arte" | "recursos" | "atelie" | "cta";
type Word = { text: string; startMs: number; endMs: number };
type Segment = { id: SceneId; text: string; file: string; durationMs: number; words: Word[] };

export const segments = narration as Segment[];

export const sceneFrames = segments.map((s) =>
  Math.ceil((LEAD + s.durationMs / 1000 + TAIL + (EXTRA[s.id] ?? 0)) * FPS),
);
export const sceneStarts = sceneFrames.map((_, i) => sceneFrames.slice(0, i).reduce((a, b) => a + b, 0) - i * T);
export const TOTAL_FRAMES = sceneStarts[sceneStarts.length - 1] + sceneFrames[sceneFrames.length - 1];
export const LEAD_FRAMES = Math.round(LEAD * FPS);

const index = (id: SceneId) => segments.findIndex((s) => s.id === id);
export const sceneLength = (id: SceneId) => sceneFrames[index(id)];

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// frame (relativo à cena) em que a palavra começa a ser falada
export const wordFrame = (id: SceneId, word: string, occurrence = 0) => {
  const matches = segments[index(id)].words.filter((w) => norm(w.text) === norm(word));
  const w = matches[occurrence] ?? matches[0];
  if (!w) throw new Error(`Palavra "${word}" não encontrada em ${id}`);
  return LEAD_FRAMES + Math.round((w.startMs / 1000) * FPS);
};

export const speechRanges = segments.map((s, i) => ({
  from: sceneStarts[i] + LEAD_FRAMES,
  to: sceneStarts[i] + LEAD_FRAMES + Math.round((s.durationMs / 1000) * FPS),
}));
