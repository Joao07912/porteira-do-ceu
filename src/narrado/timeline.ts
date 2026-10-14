import narration from "../narration.json";

export const FPS = 30;
export const T = 15; // transição entre cenas (frames)
const LEAD = 0.35; // respiro antes da fala (s)
const TAIL = 0.75; // respiro depois da fala (s)
const EXTRA: Record<string, number> = { cta: 2.2 }; // segura a última cena

export type SegmentId = "caminho" | "estrada" | "garrafa" | "beneficios" | "arte" | "cta";

export type Word = { text: string; startMs: number; endMs: number };
export type Segment = { id: SegmentId; text: string; file: string; durationMs: number; words: Word[] };

export const segments = narration as Segment[];

export const sceneFrames = segments.map((s) =>
  Math.ceil((LEAD + s.durationMs / 1000 + TAIL + (EXTRA[s.id] ?? 0)) * FPS),
);

// início de cada cena no vídeo inteiro (as transições sobrepõem T frames)
export const sceneStarts = sceneFrames.map((_, i) => sceneFrames.slice(0, i).reduce((a, b) => a + b, 0) - i * T);

export const TOTAL_FRAMES = sceneStarts[sceneStarts.length - 1] + sceneFrames[sceneFrames.length - 1];

export const LEAD_FRAMES = Math.round(LEAD * FPS);

export const getSegment = (id: SegmentId) => segments.find((s) => s.id === id)!;

export const sceneLength = (id: SegmentId) => sceneFrames[segments.findIndex((s) => s.id === id)];

// frame (relativo ao início da cena) em que a palavra começa a ser falada
export const wordFrame = (id: SegmentId, word: string, occurrence = 0) => {
  const matches = getSegment(id).words.filter((w) => w.text.toLowerCase() === word.toLowerCase());
  const w = matches[occurrence] ?? matches[0];
  if (!w) throw new Error(`Palavra "${word}" não encontrada em ${id}`);
  return LEAD_FRAMES + Math.round((w.startMs / 1000) * FPS);
};
