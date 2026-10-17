import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { display, mono, palette, progress } from "./kinetic";

export const HANDLE = "@juntoscommariaatelie";
export const ATELIE_LOGO = "v3/atelie-logo.png";

// florzinha de 5 pétalas (como as do logo do ateliê)
const Flower: React.FC<{ x: number; y: number; r: number; rot?: number }> = ({ x, y, r, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse
        key={a}
        cx={0}
        cy={-r * 0.62}
        rx={r * 0.42}
        ry={r * 0.62}
        fill={palette.sky}
        opacity={0.85}
        transform={`rotate(${a})`}
      />
    ))}
    <circle r={r * 0.24} fill="#fff" />
    <circle r={r * 0.12} fill={palette.gold} />
  </g>
);

const Leaf: React.FC<{ x: number; y: number; s: number; rot: number }> = ({ x, y, s, rot }) => (
  <path
    d="M 0 0 Q 10 -14 0 -34 Q -10 -14 0 0 Z"
    transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
    fill={palette.sage}
    opacity={0.9}
  />
);

// ramo floral que cresce e balança de leve
export const Florals: React.FC<{
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  flip?: boolean;
  at?: number;
}> = ({ x, y, scale = 1, rotate = 0, flip = false, at = 0 }) => {
  const frame = useCurrentFrame();
  const grow = progress(frame, at, 30);
  const sway = Math.sin((frame + x) / 40) * 2.5;
  return (
    <svg
      viewBox="-20 -260 260 280"
      width={260 * scale}
      height={280 * scale}
      style={{
        position: "absolute",
        left: x,
        top: y,
        overflow: "visible",
        transform: `rotate(${rotate + sway}deg) scaleX(${flip ? -1 : 1}) scale(${grow})`,
        transformOrigin: "10% 95%",
        opacity: grow,
      }}
    >
      <path
        d="M 0 0 Q 60 -60 90 -130 Q 115 -190 200 -230"
        stroke={palette.sage}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <path d="M 70 -95 Q 120 -110 150 -90" stroke={palette.sage} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Leaf x={30} y={-30} s={1} rot={60} />
      <Leaf x={52} y={-62} s={1.1} rot={-30} />
      <Leaf x={82} y={-112} s={1.05} rot={70} />
      <Leaf x={104} y={-160} s={0.95} rot={-20} />
      <Leaf x={150} y={-205} s={0.9} rot={80} />
      <Leaf x={128} y={-100} s={0.8} rot={110} />
      <Flower x={200} y={-230} r={30} rot={10} />
      <Flower x={152} y={-90} r={22} rot={-15} />
      <Flower x={92} y={-140} r={14} rot={30} />
    </svg>
  );
};

// ícone genérico de câmera (Instagram)
export const InstaIcon: React.FC<{ size: number; color?: string }> = ({ size, color = palette.navy }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke={color} strokeWidth={4}>
    <rect x={5} y={5} width={38} height={38} rx={12} />
    <circle cx={24} cy={24} r={9} />
    <circle cx={35} cy={13} r={2.2} fill={color} stroke="none" />
  </svg>
);

export const HandlePill: React.FC<{ at: number; size?: number }> = ({ at, size = 44 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 13 } });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.4,
        padding: `${size * 0.42}px ${size * 0.9}px ${size * 0.42}px ${size * 0.6}px`,
        borderRadius: 999,
        background: "#fff",
        boxShadow: "0 14px 40px rgba(36,60,108,0.16)",
        border: `2px solid ${palette.sky}`,
        transform: `scale(${p})`,
        opacity: Math.min(1, p * 1.6),
      }}
    >
      <InstaIcon size={size * 1.15} />
      <span style={{ fontFamily: display, fontWeight: 700, fontSize: size, color: palette.navy, letterSpacing: -0.5 }}>
        {HANDLE}
      </span>
    </div>
  );
};

// logo do ateliê em círculo, com aro azul e sombra suave
export const AtelieLogo: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      boxShadow: `0 0 0 ${Math.max(3, size * 0.012)}px ${palette.sky}, 0 24px 60px rgba(36,60,108,0.22)`,
      ...style,
    }}
  >
    <Img src={staticFile(ATELIE_LOGO)} style={{ width: size, height: size, display: "block" }} />
  </div>
);

export const CreditRow: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, 22);
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 26, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}
    >
      <AtelieLogo size={128} />
      <div>
        <div
          style={{ fontFamily: mono, fontSize: 24, letterSpacing: 6, color: palette.muted, textTransform: "uppercase" }}
        >
          Feita por
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 40, color: palette.navy, letterSpacing: -0.5 }}>
          {HANDLE}
        </div>
      </div>
    </div>
  );
};

// granulado de filme bem sutil por cima de tudo
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.09 }}>
      <svg width={1080} height={1920}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={frame % 7} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={1080} height={1920} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
