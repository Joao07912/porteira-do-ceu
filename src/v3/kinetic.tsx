import { loadFont as loadDisplay } from "@remotion/google-fonts/Archivo";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export const display = loadDisplay("normal", { weights: ["500", "600", "800"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily;

export const palette = {
  cream: "#F6EEE2",
  sand: "#EADCC6",
  ink: "#1B2233",
  navy: "#1E3A6E",
  deep: "#13264A",
  orange: "#E2763A",
  gold: "#F3BC69",
  muted: "#8B8577",
};

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const progress = (frame: number, at: number, len = 18, easing = easeOut) =>
  interpolate(frame - at, [0, len], [0, 1], { ...clamp, easing });

// Linha de título: cada palavra sobe de dentro de uma máscara, uma depois da outra.
export const Line: React.FC<{
  text: string;
  at: number;
  color?: string;
  size?: number;
  stagger?: number;
  align?: "left" | "center";
}> = ({ text, at, color = palette.ink, size = 120, stagger = 3, align = "left" }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: size * 0.26,
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: -size * 0.03,
        color,
      }}
    >
      {words.map((w, i) => {
        const p = progress(frame, at + i * stagger, 20);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.08, marginBottom: -size * 0.08 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 110}%)` }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

// Rótulo pequeno em mono, letra por letra.
export const Kicker: React.FC<{ text: string; at: number; color?: string; size?: number; align?: "left" | "center" }> = ({
  text,
  at,
  color = palette.orange,
  size = 30,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const n = Math.floor(interpolate(frame - at, [0, text.length * 1.2], [0, text.length], clamp));
  return (
    <div
      style={{
        fontFamily: mono,
        fontWeight: 500,
        fontSize: size,
        letterSpacing: size * 0.32,
        textTransform: "uppercase",
        color,
        textAlign: align,
        minHeight: size * 1.3,
      }}
    >
      {text.slice(0, n)}
    </div>
  );
};

// Texto de apoio: palavras aparecem em sequência.
export const Body: React.FC<{
  text: string;
  at: number;
  color?: string;
  size?: number;
  perWord?: number;
  align?: "left" | "center";
}> = ({ text, at, color = palette.ink, size = 42, perWord = 2.5, align = "left" }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: display,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.35,
        color,
        textAlign: align,
        textWrap: "pretty",
      }}
    >
      {text.split(" ").map((w, i) => {
        const p = progress(frame, at + i * perWord, 10);
        return (
          <span key={i} style={{ opacity: p, display: "inline-block", transform: `translateY(${(1 - p) * 10}px)`, marginRight: size * 0.26 }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// Marca da Porteira do Céu: porteira azul, toco de madeira com sininho e o sol nascendo atrás.
export const GateMark: React.FC<{ size: number; color?: string; accent?: string }> = ({
  size,
  color = palette.navy,
  accent = palette.orange,
}) => {
  const wood = "#7a4a2a";
  const woodDark = "#55321b";
  const gold = "#d9a23c";
  return (
    <svg viewBox="0 0 170 120" width={size} height={(size * 120) / 170}>
      {/* sol nascendo atrás da porteira */}
      <path d="M 62 78 A 44 44 0 0 1 150 78 Z" fill={accent} opacity={0.18} />
      <path d="M 70 78 A 36 36 0 0 1 142 78" fill="none" stroke={accent} strokeWidth={5} strokeLinecap="round" />
      <circle cx={106} cy={66} r={11} fill={accent} />
      {/* toco de madeira com veios */}
      <path d="M 14 116 L 14 16 Q 14 9 21 8 L 31 9 Q 35 10 35 16 L 35 116 Z" fill={wood} />
      <path d="M 20 24 Q 18 60 21 110 M 28 18 Q 30 56 27 112" stroke={woodDark} strokeWidth={1.6} fill="none" opacity={0.8} />
      <ellipse cx={24.5} cy={10} rx={10.5} ry={3} fill={woodDark} />
      <path d="M 14 30 h 21 M 14 34 h 21" stroke={woodDark} strokeWidth={2.2} />
      {/* suporte de ferro em espiral */}
      <path d="M 35 22 L 56 22 Q 64 22 63 30" stroke="#2a2522" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M 35 32 Q 46 32 46 24 Q 46 18 40 19 Q 36 21 39 25" stroke="#2a2522" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {/* sininho */}
      <line x1={63} y1={30} x2={63} y2={35} stroke="#2a2522" strokeWidth={2} />
      <path d="M 63 34 Q 55 34 55 44 Q 55 50 51 53 L 75 53 Q 71 50 71 44 Q 71 34 63 34 Z" fill={gold} />
      <path d="M 58 40 Q 58 36 61 35.5" stroke="#f6dc9a" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <rect x={50} y={52} width={26} height={3.2} rx={1.6} fill="#b7832a" />
      <circle cx={63} cy={57.5} r={2.6} fill="#b7832a" />
      {/* porteira */}
      <rect x={40} y={60} width={8} height={56} rx={1.5} fill={color} />
      <rect x={152} y={60} width={8} height={56} rx={1.5} fill={color} />
      {[66, 79, 92, 105].map((y) => (
        <rect key={y} x={48} y={y} width={104} height={7} rx={1.2} fill={color} />
      ))}
      <path d="M 50 113 L 100 70 L 150 113" fill="none" stroke={color} strokeWidth={6} strokeLinejoin="round" />
      <rect x={97} y={64} width={6} height={50} fill={color} />
    </svg>
  );
};