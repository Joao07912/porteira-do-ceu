import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { sans, colors } from "../theme";
import { FPS, LEAD_FRAMES, Segment, sceneStarts, segments } from "./timeline";

type Chunk = { words: { text: string; start: number; end: number }[]; start: number; end: number };

// quebra a fala em blocos curtos: no fim de cada frase/vírgula ou a cada 5 palavras
const toChunks = (seg: Segment): Chunk[] => {
  const display = seg.text.split(/\s+/);
  const words = seg.words.map((w, i) => ({
    text: display.length === seg.words.length ? display[i] : w.text,
    start: Math.round((w.startMs / 1000) * FPS),
    end: Math.round((w.endMs / 1000) * FPS),
  }));
  // primeiro separa por pontuação; frases longas viram partes de tamanho parecido
  const phrases: Chunk["words"][] = [];
  let cur: Chunk["words"] = [];
  words.forEach((w, i) => {
    cur.push(w);
    if (i === words.length - 1 || /[.,:!?]$/.test(w.text)) {
      phrases.push(cur);
      cur = [];
    }
  });
  const chunks: Chunk[] = phrases.flatMap((p) => {
    const parts = p.length <= 6 ? 1 : Math.ceil(p.length / 5);
    const size = Math.ceil(p.length / parts);
    return Array.from({ length: parts }, (_, k) => p.slice(k * size, (k + 1) * size)).map((ws) => ({
      words: ws,
      start: ws[0].start,
      end: ws[ws.length - 1].end,
    }));
  });
  return chunks.map((c, i) => ({ ...c, end: chunks[i + 1]?.start ?? c.end + 12 }));
};

const ChunkView: React.FC<{ chunk: Chunk }> = ({ chunk }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 170 }}>
      <div
        style={{
          maxWidth: 920,
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 700,
          fontSize: 54,
          lineHeight: 1.25,
          opacity: appear,
          transform: `translateY(${(1 - appear) * 12}px)`,
          textShadow: "0 3px 14px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)",
        }}
      >
        {chunk.words.map((w, i) => {
          const spoken = frame + chunk.start >= w.start;
          return (
            <span key={i} style={{ color: spoken ? colors.gold : colors.cream }}>
              {w.text.replace(/[.,:]$/, "")}{" "}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{ hide?: string[] }> = ({ hide = [] }) => (
  <AbsoluteFill>
    {segments.map((seg, i) =>
      hide.includes(seg.id)
        ? null
        : toChunks(seg).map((c, j) => (
            <Sequence
              key={`${seg.id}-${j}`}
              from={sceneStarts[i] + LEAD_FRAMES + c.start}
              durationInFrames={Math.max(1, c.end - c.start)}
              layout="none"
            >
              <ChunkView chunk={c} />
            </Sequence>
          )),
    )}
  </AbsoluteFill>
);
