import { useId } from "react";
import { AbsoluteFill, random } from "remotion";

export type Sky = { top: string; mid: string; horizon: string; sun: string; glow: string };

export const skies = {
  dawn: { top: "#241d47", mid: "#b8577a", horizon: "#f7a65e", sun: "#ffe2a8", glow: "rgba(255,170,90,0.55)" },
  day: { top: "#4b78ad", mid: "#e9b277", horizon: "#ffdca0", sun: "#fff3d6", glow: "rgba(255,220,150,0.6)" },
  sunset: { top: "#17214a", mid: "#c9544a", horizon: "#ffb257", sun: "#ffe0a0", glow: "rgba(255,150,70,0.6)" },
} satisfies Record<string, Sky>;

type Wave = [amp: number, freq: number, phase: number];

export const ridgeY = (x: number, base: number, waves: Wave[], offset = 0) =>
  base + waves.reduce((acc, [a, f, p]) => acc + a * Math.sin((x + offset) * f + p), 0);

const hillPath = (base: number, waves: Wave[], offset: number, width = 1080, height = 1920) => {
  let d = `M -40 ${height} L -40 ${ridgeY(-40, base, waves, offset).toFixed(1)}`;
  for (let x = -20; x <= width + 40; x += 20) d += ` L ${x} ${ridgeY(x, base, waves, offset).toFixed(1)}`;
  return d + ` L ${width + 40} ${height} Z`;
};

const Tree: React.FC<{ x: number; y: number; s: number; fill: string }> = ({ x, y, s, fill }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
    <rect x={-4} y={-40} width={8} height={42} />
    <circle cx={0} cy={-58} r={26} />
    <circle cx={-20} cy={-44} r={18} />
    <circle cx={20} cy={-46} r={20} />
  </g>
);

export type Layer = { base: number; waves: Wave[]; color: string; speed: number; trees?: number; seed?: string };

export const LandscapeLayers = {
  far: {
    base: 1080,
    waves: [
      [40, 0.004, 0.5],
      [18, 0.011, 2],
    ],
    color: "#6d4f78",
    speed: 0.15,
  },
  mid: {
    base: 1220,
    waves: [
      [55, 0.0035, 2.2],
      [20, 0.009, 0.3],
    ],
    color: "#4a2f45",
    speed: 0.5,
    trees: 5,
    seed: "mid",
  },
  near: {
    base: 1420,
    waves: [
      [35, 0.003, 1],
      [12, 0.012, 4],
    ],
    color: "#2a1a22",
    speed: 1.4,
    trees: 3,
    seed: "near",
  },
} satisfies Record<string, Layer> as Record<"far" | "mid" | "near", Layer>;

export const Landscape: React.FC<{
  sky: Sky;
  sunY: number;
  sunX?: number;
  scroll: number;
  layers?: Layer[];
  children?: React.ReactNode;
}> = ({ sky, sunY, sunX = 640, scroll, layers = Object.values(LandscapeLayers), children }) => {
  const u = useId().replace(/:/g, "");
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <defs>
          <linearGradient id={`sky-${u}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.top} />
            <stop offset="0.45" stopColor={sky.mid} />
            <stop offset="0.68" stopColor={sky.horizon} />
          </linearGradient>
          <radialGradient id={`glow-${u}`}>
            <stop offset="0" stopColor={sky.glow} />
            <stop offset="1" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id={`haze-${u}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.horizon} stopOpacity={0} />
            <stop offset="0.35" stopColor={sky.horizon} stopOpacity={0.5} />
            <stop offset="1" stopColor={sky.horizon} stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect width={1080} height={1920} fill={`url(#sky-${u})`} />
        <circle cx={sunX} cy={sunY} r={520} fill={`url(#glow-${u})`} />
        <circle cx={sunX} cy={sunY} r={95} fill={sky.sun} />
        {layers.map((l, i) => {
          const offset = scroll * l.speed;
          return (
            <g key={i}>
              <path d={hillPath(l.base, l.waves, offset)} fill={l.color} />
              {Array.from({ length: l.trees ?? 0 }).map((_, t) => {
                // árvores presas ao relevo, repetindo a cada 1400px
                const span = 1400;
                const raw = random(`${l.seed}-${t}`) * span - offset;
                const x = (((raw % span) + span) % span) - 160;
                return (
                  <Tree key={t} x={x} y={ridgeY(x, l.base, l.waves, offset) + 6} s={0.7 + i * 0.35} fill={l.color} />
                );
              })}
              {i === 0 && <rect y={l.base - 80} width={1080} height={260} fill={`url(#haze-${u})`} />}
            </g>
          );
        })}
      </svg>
      {children}
    </AbsoluteFill>
  );
};

export const Motes: React.FC<{ frame: number; count?: number; color?: string }> = ({
  frame,
  count = 28,
  color = "#ffd9a0",
}) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {Array.from({ length: count }).map((_, i) => {
      const x = random(`mx${i}`) * 1080 + Math.sin(frame / 40 + i) * 20;
      const y = (((random(`my${i}`) * 1920 - frame * (0.4 + random(`ms${i}`) * 0.8)) % 1920) + 1920) % 1920;
      const s = 3 + random(`mr${i}`) * 6;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: s,
            height: s,
            borderRadius: "50%",
            background: color,
            opacity: 0.25 + random(`mo${i}`) * 0.4,
            boxShadow: `0 0 ${s * 2}px ${color}`,
          }}
        />
      );
    })}
  </AbsoluteFill>
);
