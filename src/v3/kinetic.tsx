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

// Ícone da porteira (marca tipográfica, já que a loja ainda não tem logo).
export const GateMark: React.FC<{ size: number; color?: string; accent?: string }> = ({
  size,
  color = palette.navy,
  accent = palette.orange,
}) => (
  <svg viewBox="0 0 120 90" width={size} height={(size * 90) / 120}>
    <path d="M14 44 A46 46 0 0 1 106 44" fill="none" stroke={accent} strokeWidth={5} strokeLinecap="round" />
    <circle cx={60} cy={44} r={10} fill={accent} />
    <rect x={10} y={40} width={9} height={46} rx={2} fill={color} />
    <rect x={101} y={40} width={9} height={46} rx={2} fill={color} />
    {[50, 63, 76].map((y) => (
      <rect key={y} x={19} y={y} width={82} height={6} rx={1} fill={color} />
    ))}
    <path d="M22 84 L60 50 L98 84" fill="none" stroke={color} strokeWidth={6} />
  </svg>
);
