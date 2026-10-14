import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { colors, sans, serif } from "../theme";
import { Bottle } from "./Bottle";
import { Captions } from "./Captions";
import { Landscape, LandscapeLayers, Layer, Motes, ridgeY, skies } from "./Landscape";
import { Pilgrim } from "./Pilgrim";
import { LEAD_FRAMES, T, sceneFrames, sceneLength, sceneStarts, segments, wordFrame } from "./timeline";

// Música de fundo: coloque o arquivo em public/ e troque null pelo nome, ex.: "musica.mp3"
const MUSIC: string | null = null;
const MUSIC_VOLUME = 0.35;
const MUSIC_DUCKED = 0.12; // volume enquanto a narração fala

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const appear = (frame: number, at: number, len = 20) =>
  interpolate(frame - at, [0, len], [0, 1], { ...clamp, easing: ease });

const Fade: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number }> = ({
  at,
  children,
  style,
  dy = 30,
}) => {
  const frame = useCurrentFrame();
  const p = appear(frame, at);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, filter: `blur(${(1 - p) * 6}px)`, ...style }}>
      {children}
    </div>
  );
};

const titleStyle: React.CSSProperties = {
  fontFamily: serif,
  fontWeight: 700,
  color: colors.gold,
  textAlign: "center",
  lineHeight: 1,
  textShadow: "0 6px 40px rgba(0,0,0,0.55)",
};

const kicker: React.CSSProperties = {
  fontFamily: sans,
  fontWeight: 500,
  fontSize: 38,
  letterSpacing: 8,
  textTransform: "uppercase",
  color: colors.cream,
  textAlign: "center",
};

const WarmBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 52%, #5a3416 0%, #2a170a 45%, #0d0805 100%)" }}>
      <AbsoluteFill
        style={{
          opacity: 0.18,
          background: "repeating-conic-gradient(from 0deg at 50% 52%, #ffcf86 0deg 4deg, transparent 4deg 18deg)",
          transform: `rotate(${frame * 0.08}deg) scale(1.6)`,
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at 50% 52%, rgba(0,0,0,0) 30%, rgba(13,8,5,0.9) 80%)" }}
      />
    </AbsoluteFill>
  );
};

/* ---------- 1. Caminho da Fé (amanhecer) ---------- */
const SceneCaminho: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("caminho");
  const mid = LandscapeLayers.mid;
  const scroll = frame * 0.8;
  const px = interpolate(frame, [0, len], [250, 470]);
  const groundY = ridgeY(px + 50, mid.base, mid.waves, scroll * mid.speed);
  const zoom = interpolate(frame, [0, len], [1, 1.08]);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 65%" }}>
      <Landscape
        sky={skies.dawn}
        sunY={interpolate(frame, [0, len], [1130, 1040])}
        sunX={700}
        scroll={scroll}
        layers={[LandscapeLayers.far, mid]}
      >
        <Pilgrim phase={frame * 0.2} height={170} style={{ position: "absolute", left: px, top: groundY - 166 }} />
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          <path
            d={`M -40 1920 L -40 1460 Q 300 1380 560 1430 T 1120 1400 L 1120 1920 Z`}
            fill={LandscapeLayers.near.color}
          />
        </svg>
      </Landscape>
      <Motes frame={frame} count={18} />
      <AbsoluteFill style={{ paddingTop: 330 }}>
        <Fade at={wordFrame("caminho", "No") - 4}>
          <div style={kicker}>No</div>
        </Fade>
        <Fade at={wordFrame("caminho", "Caminho")}>
          <div style={{ ...titleStyle, fontSize: 150, marginTop: 14 }}>Caminho da Fé</div>
        </Fade>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 2. Estrada (sol, poeira, água fresca) ---------- */
const SceneEstrada: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("estrada");
  const agua = wordFrame("estrada", "água");
  const pace = interpolate(frame, [agua - 20, agua + 10], [1, 0.35], clamp);
  // integra a velocidade pra caminhada desacelerar suavemente
  let travel = 0;
  for (let f = 0; f < frame; f++) travel += interpolate(f, [agua - 20, agua + 10], [1, 0.35], clamp);
  const pilgrimH = 820;
  const s = pilgrimH / 400;
  const left = 300;
  const top = 1560 - 392 * s;
  const bottle = { x: left + 40 * s, y: top + 178 * s };
  const zoom = interpolate(frame, [agua, len], [1, 2.3], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const glow = interpolate(frame, [agua, agua + 15], [0, 1], clamp);
  const layers: Layer[] = [
    { ...LandscapeLayers.far, base: 1040, color: "#8a6c84" },
    { ...LandscapeLayers.mid, base: 1180, color: "#6a4a50" },
    { ...LandscapeLayers.near, base: 1360, color: "#4a3030", speed: 1.2 },
  ];
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${bottle.x}px ${bottle.y}px` }}>
      <Landscape sky={skies.day} sunY={430} sunX={820} scroll={travel * 4} layers={layers}>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          <rect y={1490} width={1080} height={430} fill="#7a4e2c" />
          <rect y={1490} width={1080} height={26} fill="#5c3a20" />
          {Array.from({ length: 8 }).map((_, i) => {
            const x = ((((i * 180 - travel * 9) % 1440) + 1440) % 1440) - 120;
            return (
              <g key={i} fill="#3a2414">
                <rect x={x} y={1380} width={16} height={130} />
                <rect x={x - 90} y={1405} width={196} height={10} />
                <rect x={x - 90} y={1445} width={196} height={10} />
              </g>
            );
          })}
        </svg>
        <Pilgrim
          phase={travel * 0.21}
          bottleGlow={glow}
          height={pilgrimH}
          style={{ position: "absolute", left, top }}
        />
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const x = ((((i * 137 - travel * 14) % 1200) + 1200) % 1200) - 60;
            return <ellipse key={i} cx={x} cy={1700 + (i % 3) * 70} rx={60} ry={8} fill="#5c3a20" opacity={0.6} />;
          })}
        </svg>
      </Landscape>
      <Motes frame={frame} count={30} color="#ffe2b5" />
      <AbsoluteFill style={{ background: `rgba(255,190,110,${0.12 * pace})`, mixBlendMode: "overlay" }} />
    </AbsoluteFill>
  );
};

/* ---------- 3. A garrafa ---------- */
const SceneGarrafa: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - 4, fps, config: { damping: 16, mass: 0.9 } });
  const shine = interpolate(frame, [30, 70], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <WarmBackdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 640 }}>
        <Bottle
          width={300}
          turn={frame / 260}
          shine={shine > 0 && shine < 1 ? shine : 0}
          style={{ transform: `translateY(${(1 - rise) * 900}px)` }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ paddingTop: 230 }}>
        <Fade at={wordFrame("garrafa", "garrafa")}>
          <div style={kicker}>Garrafa térmica</div>
        </Fade>
        <Fade at={wordFrame("garrafa", "Porteira")}>
          <div style={{ ...titleStyle, fontSize: 128, marginTop: 20 }}>Porteira do Céu</div>
        </Fade>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 4. Benefícios ---------- */
const Icon: React.FC<{ kind: "drop" | "snow" | "clip" }> = ({ kind }) => (
  <svg
    viewBox="0 0 60 60"
    width={64}
    height={64}
    fill="none"
    stroke={colors.gold}
    strokeWidth={4}
    strokeLinecap="round"
  >
    {kind === "drop" && <path d="M30 8 C 22 22 14 30 14 38 a16 16 0 0 0 32 0 C 46 30 38 22 30 8 Z" />}
    {kind === "snow" && (
      <g>
        <line x1={30} y1={8} x2={30} y2={52} />
        <line x1={11} y1={19} x2={49} y2={41} />
        <line x1={11} y1={41} x2={49} y2={19} />
        <path d="M24 12 L30 18 L36 12 M24 48 L30 42 L36 48" />
      </g>
    )}
    {kind === "clip" && (
      <g>
        <rect x={16} y={6} width={28} height={48} rx={14} />
        <line x1={44} y1={20} x2={44} y2={40} stroke="#0d0805" strokeWidth={6} />
        <line x1={40} y1={18} x2={34} y2={40} />
      </g>
    )}
  </svg>
);

const Benefit: React.FC<{ at: number; icon: "drop" | "snow" | "clip"; title: string; text: string }> = ({
  at,
  icon,
  title,
  text,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        opacity: Math.min(1, p * 1.5),
        transform: `translateX(${(1 - p) * 140}px)`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 112,
          height: 112,
          borderRadius: "50%",
          background: colors.blue,
          border: `3px solid ${colors.gold}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon kind={icon} />
      </div>
      <div>
        <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 70, color: colors.gold, lineHeight: 1 }}>
          {title}
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 500,
            fontSize: 32,
            color: colors.cream,
            marginTop: 8,
            lineHeight: 1.25,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

const SceneBeneficios: React.FC = () => {
  const frame = useCurrentFrame();
  const slide = appear(frame, 0, 30);
  return (
    <AbsoluteFill>
      <WarmBackdrop />
      <div style={{ position: "absolute", left: interpolate(slide, [0, 1], [390, 90]), top: 470 }}>
        <Bottle width={interpolate(slide, [0, 1], [300, 250])} turn={(frame + 200) / 260} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 440,
          right: 50,
          top: 560,
          display: "flex",
          flexDirection: "column",
          gap: 90,
        }}
      >
        <Benefit at={wordFrame("beneficios", "seiscentos")} icon="drop" title="600 ml" text="pra caminhada inteira" />
        <Benefit
          at={wordFrame("beneficios", "geladinha")}
          icon="snow"
          title="Térmica"
          text="água geladinha por mais tempo"
        />
        <Benefit at={wordFrame("beneficios", "mosquetão")} icon="clip" title="Mosquetão" text="prende na mochila" />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 5. A arte ---------- */
const SceneArte: React.FC = () => {
  const frame = useCurrentFrame();
  const h = 1000;
  const w = (h * 1600) / 689;
  const target = (artX: number) => Math.max(1080 - w, Math.min(0, 540 - (artX / 1600) * w));
  const porteira = wordFrame("arte", "Porteira");
  const aparecida = wordFrame("arte", "Aparecida");
  const len = sceneLength("arte");
  const x = interpolate(
    frame,
    [0, porteira, aparecida - 6, len],
    [target(380), target(690), target(1420), target(1440)],
    {
      ...clamp,
      easing: Easing.inOut(Easing.cubic),
    },
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0805" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, #3a2210, #0d0805 70%)" }} />
      <div style={{ position: "absolute", top: 450, height: h, width: 1080, overflow: "hidden" }}>
        <Img src={staticFile("Arte.jpg")} style={{ position: "absolute", height: h, width: w, left: x }} />
      </div>
      <AbsoluteFill style={{ paddingTop: 200 }}>
        <Fade at={wordFrame("arte", "arte")}>
          <div style={kicker}>Arte</div>
        </Fade>
        <Fade at={wordFrame("arte", "exclusiva")}>
          <div style={{ ...titleStyle, fontSize: 120, marginTop: 14 }}>exclusiva</div>
        </Fade>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 6. Chamada final ---------- */
const Gate: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg viewBox="0 0 560 420" width={560} style={style}>
    <rect x={20} y={20} width={34} height={400} fill="#3a2414" />
    <path d="M54 60 q 40 -10 60 20" stroke="#1b110b" strokeWidth={6} fill="none" />
    <path d="M98 78 q 16 0 18 30 l 8 14 h -52 l 8 -14 q 2 -30 18 -30 z" fill="#c8913a" />
    <circle cx={98} cy={128} r={6} fill="#8a5a1a" />
    <rect x={500} y={120} width={34} height={300} fill="#1e3a6e" />
    <rect x={60} y={140} width={440} height={40} fill="#d9c7a2" />
    {[205, 260, 315, 370].map((y) => (
      <rect key={y} x={60} y={y} width={440} height={32} fill="#cbb58c" />
    ))}
    <rect x={56} y={130} width={30} height={290} fill="#1e3a6e" />
    <path d="M 86 400 L 280 190 L 474 400" stroke="#1e3a6e" strokeWidth={26} fill="none" />
    <rect x={266} y={185} width={28} height={230} fill="#1e3a6e" />
    <text x={280} y={170} textAnchor="middle" fontFamily={sans} fontWeight={700} fontSize={28} fill="#1e3a6e">
      PORTEIRA DO CÉU
    </text>
  </svg>
);

const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();
  const layers: Layer[] = [
    LandscapeLayers.far,
    { ...LandscapeLayers.mid, trees: 4 },
    { base: 1560, waves: [[18, 0.004, 1.5]], color: "#24151a", speed: 0.6 },
  ];
  const zoom = interpolate(frame, [0, sceneLength("cta")], [1.06, 1]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 80%" }}>
        <Landscape sky={skies.sunset} sunY={1150} sunX={540} scroll={frame * 0.4} layers={layers}>
          <Gate style={{ position: "absolute", left: 150, top: 1160 }} />
          <Pilgrim phase={0} walking={false} height={390} style={{ position: "absolute", left: 720, top: 1180 }} />
        </Landscape>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(13,8,5,0.55), rgba(13,8,5,0) 45%)" }} />
      <AbsoluteFill style={{ paddingTop: 230, alignItems: "center" }}>
        <Fade at={wordFrame("cta", "Agora")}>
          <div style={kicker}>Agora você encontra na</div>
        </Fade>
        <Fade at={wordFrame("cta", "Porteira")} dy={50}>
          <div style={{ ...titleStyle, fontSize: 150, marginTop: 24 }}>Porteira do Céu</div>
        </Fade>
        <div
          style={{
            marginTop: 36,
            height: 4,
            borderRadius: 2,
            background: colors.gold,
            width: 440 * appear(frame, wordFrame("cta", "Céu"), 25),
          }}
        />
        <Fade at={wordFrame("cta", "companheira") - 8} style={{ marginTop: 40, padding: "0 90px" }}>
          <div
            style={{
              fontFamily: serif,
              fontWeight: 500,
              fontSize: 64,
              color: colors.cream,
              textAlign: "center",
              lineHeight: 1.2,
              textWrap: "balance",
            }}
          >
            A sua companheira no Caminho da Fé
          </div>
        </Fade>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- montagem ---------- */
const scenes: Record<string, React.FC> = {
  caminho: SceneCaminho,
  estrada: SceneEstrada,
  garrafa: SceneGarrafa,
  beneficios: SceneBeneficios,
  arte: SceneArte,
  cta: SceneCta,
};

export const Narrado: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const speech = segments.map((s, i) => ({
    from: sceneStarts[i] + LEAD_FRAMES,
    to: sceneStarts[i] + LEAD_FRAMES + Math.round((s.durationMs / 1000) * 30),
  }));
  const musicVolume = (f: number) => {
    const talking = speech.some((r) => f >= r.from - 8 && f <= r.to + 8);
    const fadeOut = interpolate(f, [durationInFrames - 45, durationInFrames], [1, 0], clamp);
    const fadeIn = interpolate(f, [0, 20], [0, 1], clamp);
    return (talking ? MUSIC_DUCKED : MUSIC_VOLUME) * fadeIn * fadeOut;
  };
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0805" }}>
      <TransitionSeries>
        {segments.map((s, i) => {
          const Scene = scenes[s.id];
          return [
            i > 0 && (
              <TransitionSeries.Transition
                key={`t${i}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: T })}
              />
            ),
            <TransitionSeries.Sequence key={s.id} durationInFrames={sceneFrames[i]}>
              <Scene />
            </TransitionSeries.Sequence>,
          ];
        })}
      </TransitionSeries>

      <Captions hide={["cta"]} />

      {segments.map((s, i) => (
        <Sequence key={s.id} from={sceneStarts[i] + LEAD_FRAMES} layout="none">
          <Audio src={staticFile(s.file)} />
        </Sequence>
      ))}
      {MUSIC && <Audio src={staticFile(MUSIC)} volume={musicVolume} loop />}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
