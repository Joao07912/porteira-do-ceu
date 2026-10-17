import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Bottle3D } from "./Bottle3D";
import { Body, GateMark, Kicker, Line, display, mono, palette, progress } from "./kinetic";
import { LEAD_FRAMES, T, sceneFrames, sceneLength, sceneStarts, segments, speechRanges, wordFrame } from "./timeline";
import { circle } from "./transitions";
import { AtelieLogo, CreditRow, Florals, Grain, HandlePill } from "./decor";
import { PX_PER_M, Pilgrim3D, WALK_CYCLE_S, WALK_SPEED } from "./Pilgrim3D";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PAD = 90;

/* ---------- 1. Gancho ---------- */
const CHIPS = [
  { text: "km 187", x: 90, y: 330, r: -4 },
  { text: "sol de 32 °C", x: 600, y: 270, r: 5, badge: "!" },
  { text: "água morna", x: 130, y: 1420, r: 3 },
  { text: "cantil vazio", x: 560, y: 1530, r: -5, badge: "0" },
  { text: "próximo ponto: 9 km", x: 470, y: 470, r: -2 },
  { text: "garrafa amassada", x: 90, y: 1600, r: 4 },
];

const Chip: React.FC<{ chip: (typeof CHIPS)[number]; i: number }> = ({ chip, i }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame + 12 - i * 3, fps, config: { damping: 12 } });
  const dx = Math.sin(frame / 30 + i) * 10;
  const dy = Math.cos(frame / 26 + i * 2) * 8;
  return (
    <div
      style={{
        position: "absolute",
        left: chip.x + dx,
        top: chip.y + dy,
        transform: `rotate(${chip.r}deg) scale(${pop})`,
        background: "#fff",
        borderRadius: 14,
        padding: "18px 28px",
        fontFamily: mono,
        fontSize: 32,
        color: "#4A5A72",
        boxShadow: "0 10px 30px rgba(60,40,20,0.12)",
      }}
    >
      {chip.text}
      {chip.badge && (
        <div
          style={{
            position: "absolute",
            right: -14,
            top: -14,
            width: 40,
            height: 40,
            borderRadius: 20,
            background: palette.accent,
            color: "#fff",
            fontFamily: display,
            fontWeight: 800,
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {chip.badge}
        </div>
      )}
    </div>
  );
};

const Hook: React.FC = () => (
  <AbsoluteFill style={{ background: palette.mist }}>
    {CHIPS.map((c, i) => (
      <Chip key={c.text} chip={c} i={i} />
    ))}
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: PAD, gap: 6 }}>
      <Line text="Você caminha" at={wordFrame("hook", "Você")} size={122} align="center" />
      <Line text="com fé." at={wordFrame("hook", "com")} size={122} align="center" />
      <div style={{ height: 30 }} />
      <Line text="Não com" at={wordFrame("hook", "Não")} size={122} align="center" color={palette.accent} />
      <Line text="sede." at={wordFrame("hook", "sede")} size={122} align="center" color={palette.accent} />
    </AbsoluteFill>
  </AbsoluteFill>
);

/* ---------- 2. Marca ---------- */
const Marca: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame: frame - 2, fps, config: { damping: 13 } });
  const ring = progress(frame, 4, 40);
  return (
    <AbsoluteFill style={{ background: palette.cream, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 1500 * ring,
          height: 1500 * ring,
          borderRadius: "50%",
          border: `3px solid ${palette.sky}`,
          opacity: 0.35 * (1 - ring) + 0.08,
        }}
      />
      <Florals x={-30} y={1500} scale={1.2} rotate={-6} at={8} />
      <Florals x={830} y={1480} scale={1.1} rotate={6} flip at={14} />
      <div style={{ transform: `scale(${mark})`, marginBottom: 40 }}>
        <GateMark size={340} />
      </div>
      <Line text="Porteira" at={wordFrame("marca", "Porteira") - 4} size={150} align="center" color={palette.navy} />
      <Line text="do Céu" at={wordFrame("marca", "Céu") - 6} size={150} align="center" color={palette.accent} />
      <div style={{ height: 40 }} />
      <Body
        text="Garrafa térmica · 600 ml"
        at={wordFrame("marca", "garrafa")}
        size={48}
        align="center"
        color={palette.ink}
      />
      <div style={{ height: 30 }} />
      <Kicker
        text="Feita para o Caminho da Fé"
        at={wordFrame("marca", "térmica")}
        color={palette.muted}
        size={26}
        align="center"
      />
    </AbsoluteFill>
  );
};

/* ---------- 3. Caminho (peregrino) ---------- */
type Wave = [number, number, number];
const ridge = (x: number, base: number, w: Wave[], off: number) =>
  base + w.reduce((a, [amp, f, p]) => a + amp * Math.sin((x + off) * f + p), 0);
const hill = (base: number, w: Wave[], off: number) => {
  let d = `M -20 1920 L -20 ${ridge(-20, base, w, off)}`;
  for (let x = 0; x <= 1100; x += 20) d += ` L ${x} ${ridge(x, base, w, off).toFixed(1)}`;
  return d + " L 1100 1920 Z";
};

const Caminho: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("caminho");
  const mochila = wordFrame("caminho", "mochila");
  // coreografia: anda → para → pega a garrafa e bebe → devolve e fica parado
  const stopAt = wordFrame("caminho", "E") - 22;
  const drinkFrom = stopAt + 16;
  const drinkLen = 100;
  const walkW = (f: number) =>
    interpolate(f, [stopAt, stopAt + 24], [1, 0], { ...clamp, easing: Easing.inOut(Easing.sin) });
  let phase = 0.1;
  let travel = 0; // px que o chão andou
  for (let f = 0; f < frame; f++) {
    const w = walkW(f);
    phase += w / (WALK_CYCLE_S * 30);
    travel += (WALK_SPEED * PX_PER_M * w) / 30; // chão anda na velocidade do pé de apoio do mocap
  }
  const drinkAt = (f: number) => interpolate(f, [drinkFrom, drinkFrom + drinkLen], [0, 1], clamp);
  const groundY = 1660;
  const cameraY = (groundY - 960) / PX_PER_M;
  const bottle = { x: 540 + -0.32 * PX_PER_M, y: 960 - (0.89 - cameraY) * PX_PER_M };
  const zoom = interpolate(frame, [mochila - 4, len], [1, 2.1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const glow = progress(frame, mochila - 4, 14);
  const gx = travel;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${bottle.x}px ${bottle.y}px` }}>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="v3sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#13264A" />
              <stop offset="0.38" stopColor="#6B3C5E" />
              <stop offset="0.56" stopColor={palette.sunset} />
              <stop offset="0.68" stopColor={palette.gold} />
            </linearGradient>
            <radialGradient id="v3sun">
              <stop offset="0" stopColor="rgba(255,226,168,0.9)" />
              <stop offset="1" stopColor="rgba(255,226,168,0)" />
            </radialGradient>
          </defs>
          <rect width={1080} height={1920} fill="url(#v3sky)" />
          <circle cx={720} cy={1210 - frame * 0.12} r={460} fill="url(#v3sun)" />
          <circle cx={720} cy={1210 - frame * 0.12} r={150} fill="#FFE6B0" />
          {[0, 1, 2].map((i) => {
            const bx = ((frame * (1.6 + i * 0.3) + i * 260) % 1400) - 200;
            const by = 820 + i * 50 + Math.sin(frame / 12 + i) * 10;
            const flap = Math.sin(frame / 3 + i) * 8;
            return (
              <path
                key={i}
                d={`M ${bx - 18} ${by - flap} Q ${bx - 8} ${by - 4} ${bx} ${by + 2} Q ${bx + 8} ${by - 4} ${bx + 18} ${by - flap}`}
                stroke="#3b2238"
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
          <path
            d={hill(
              1240,
              [
                [44, 0.004, 0.6],
                [16, 0.012, 2],
              ],
              gx * 0.08,
            )}
            fill="#C46A55"
          />
          <path
            d={hill(
              1360,
              [
                [60, 0.0032, 2],
                [18, 0.01, 0.4],
              ],
              gx * 0.22,
            )}
            fill="#86424C"
          />
          <path
            d={hill(
              1500,
              [
                [36, 0.003, 1.2],
                [12, 0.014, 3],
              ],
              gx * 0.5,
            )}
            fill="#4A2638"
          />
          <rect y={groundY} width={1080} height={1920 - groundY} fill="#2A1724" />
          {Array.from({ length: 22 }).map((_, i) => {
            const x = ((((i * 97 + random(`g${i}`) * 60 - gx) % 1300) + 1300) % 1300) - 110;
            const h = 14 + random(`gh${i}`) * 26;
            return (
              <path
                key={i}
                d={`M ${x} ${groundY + 2} l 6 ${-h} l 6 ${h} l 6 ${-h * 0.7} l 6 ${h * 0.7}`}
                fill="#2A1724"
                stroke="#2A1724"
                strokeWidth={2}
              />
            );
          })}
          {Array.from({ length: 10 }).map((_, i) => {
            const x = ((((i * 151 - gx * 1.25) % 1500) + 1500) % 1500) - 150;
            return (
              <ellipse key={i} cx={x} cy={groundY + 60 + (i % 4) * 50} rx={40 + (i % 3) * 20} ry={6} fill="#3A2232" />
            );
          })}
        </svg>
        <AbsoluteFill>
          <Pilgrim3D
            width={1080}
            height={1920}
            cameraY={cameraY}
            phase={phase}
            walk={walkW(frame)}
            drink={drinkAt(frame)}
            time={frame / 30}
            x={-0.44}
            glow={glow}
          />
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ padding: `200px ${PAD}px`, gap: 10, opacity: interpolate(frame, [len - 30, len - 10], [1, 0], clamp) }}
      >
        <Kicker text="No Caminho da Fé" at={wordFrame("caminho", "No") - 6} color={palette.gold} />
        <div style={{ height: 10 }} />
        <Line text="Cada passo," at={wordFrame("caminho", "cada")} size={128} color={palette.cream} />
        <Line text="uma oração." at={wordFrame("caminho", "uma")} size={128} color={palette.gold} />
        <div style={{ height: 24, width: 700 }} />
        <div style={{ width: 760 }}>
          <Body
            text="E a água fresquinha vai junto, presa na mochila."
            at={wordFrame("caminho", "E")}
            size={44}
            color={palette.cream}
            perWord={3.2}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 4. Arte (garrafa 3D girando) ---------- */
const Arte: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = sceneLength("arte");
  const porteira = wordFrame("arte", "Porteira");
  const aparecida = wordFrame("arte", "Aparecida");
  // rotação 0 = Nossa Senhora de frente; ≈2.55 = a placa da porteira de frente
  const rot = interpolate(
    frame,
    [0, porteira, aparecida, len],
    [2.55 - 2 * Math.PI, 2.55, 2 * Math.PI, 2 * Math.PI + 0.5],
    {
      ...clamp,
      easing: Easing.inOut(Easing.sin),
    },
  );
  const rise = spring({ frame, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ background: palette.deep }}>
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at 50% 66%, rgba(156,204,228,0.28), rgba(19,38,74,0) 55%)" }}
      />
      <div
        style={{
          position: "absolute",
          left: 540 - 230,
          top: 1745,
          width: 460,
          height: 60,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(0,0,0,0.5), rgba(0,0,0,0))",
          opacity: rise,
        }}
      />
      <div style={{ position: "absolute", top: 560, transform: `translateY(${(1 - rise) * 700}px)` }}>
        <Bottle3D width={1080} height={1300} rotation={rot} tilt={0.06} zoom={1.05} />
      </div>
      <AbsoluteFill style={{ padding: `190px ${PAD}px`, gap: 8 }}>
        <Kicker text="Arte exclusiva" at={wordFrame("arte", "arte") - 6} color={palette.gold} />
        <div style={{ height: 10 }} />
        <Line text="A Porteira do Céu" at={porteira - 3} size={104} color={palette.cream} />
        <Line text="e a Aparecida." at={wordFrame("arte", "Nossa")} size={104} color={palette.sky} />
        <div style={{ height: 18 }} />
        <Body text="Em volta da garrafa inteira." at={wordFrame("arte", "em")} size={42} color={palette.sand} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 5. Recursos ---------- */
const Pill: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 22,
        padding: "22px 40px 22px 24px",
        borderRadius: 999,
        background: palette.ink,
        color: palette.cream,
        fontFamily: display,
        fontWeight: 600,
        fontSize: 50,
        opacity: Math.min(1, p * 2),
        transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`,
        alignSelf: "flex-start",
      }}
    >
      <svg width={52} height={52} viewBox="0 0 52 52">
        <circle cx={26} cy={26} r={26} fill={palette.gold} />
        <path
          d="M15 27 l7 7 l15 -16"
          stroke="#fff"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {text}
    </div>
  );
};

const Recursos: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: palette.sand }}>
      <div style={{ position: "absolute", right: -170, bottom: -40, transform: "rotate(-10deg)" }}>
        <Bottle3D width={800} height={1150} rotation={frame / 40 + 1.2} tilt={0.05} zoom={1.1} />
      </div>
      <AbsoluteFill style={{ padding: `190px ${PAD}px`, gap: 8 }}>
        <Kicker text="O que ela tem" at={4} color={palette.accent} />
        <div style={{ height: 14 }} />
        <Line text="Tudo que o" at={8} size={118} />
        <Line text="Caminho pede." at={16} size={118} color={palette.accent} />
        <div style={{ height: 50 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <Pill text="600 ml" at={wordFrame("recursos", "Seiscentos")} />
          <Pill text="Térmica" at={wordFrame("recursos", "térmica")} />
          <Pill text="Mosquetão" at={wordFrame("recursos", "mosquetão")} />
          <Pill text="Bico esportivo" at={wordFrame("recursos", "bico")} />
          <Pill text="Arte exclusiva" at={wordFrame("recursos", "esportivo") + 8} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 6. Quem faz: Juntos com Maria Ateliê ---------- */
const Atelie: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoAt = wordFrame("atelie", "Juntos") - 8;
  const pop = spring({ frame: frame - logoAt, fps, config: { damping: 14, mass: 0.9 } });
  const float = Math.sin(frame / 26) * 8;
  const halo = progress(frame, logoAt, 40);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 52%, #ffffff 0%, ${palette.mist} 55%, ${palette.sand} 100%)`,
      }}
    >
      <Florals x={-90} y={-215} scale={1.0} rotate={160} flip at={4} />
      <Florals x={900} y={-210} scale={0.95} rotate={-160} at={10} />
      <Florals x={-90} y={1680} scale={1.1} rotate={-10} at={14} />
      <Florals x={880} y={1670} scale={1.05} rotate={10} flip at={20} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 250, gap: 6 }}>
        <Kicker text="Quem faz" at={4} color={palette.accent} align="center" />
        <div style={{ height: 14 }} />
        <Line text="Feita com amor" at={wordFrame("atelie", "Feita")} size={112} align="center" />
        <Line
          text="pra você e sua família."
          at={wordFrame("atelie", "amor")}
          size={84}
          align="center"
          color={palette.accent}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 690 }}>
        <div
          style={{
            position: "absolute",
            top: 690 + 310 - 380 * halo,
            width: 760 * halo,
            height: 760 * halo,
            borderRadius: "50%",
            border: `2px dashed ${palette.sky}`,
            opacity: 0.8 * halo,
            transform: `rotate(${frame * 0.15}deg)`,
          }}
        />
        <AtelieLogo
          size={620}
          style={{
            transform: `translateY(${float}px) scale(${pop}) rotate(${(1 - pop) * -10}deg)`,
            opacity: Math.min(1, pop * 1.5),
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 250, gap: 22 }}>
        <Kicker
          text="Siga no Instagram"
          at={wordFrame("atelie", "Siga")}
          color={palette.muted}
          size={26}
          align="center"
        />
        <HandlePill at={wordFrame("atelie", "arroba") - 6} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- 7. Chamada final ---------- */
const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const garanta = wordFrame("cta", "Garanta");
  const btn = spring({ frame: frame - garanta, fps, config: { damping: 11 } });
  const pulse = 1 + Math.max(0, Math.sin((frame - garanta - 20) / 9)) * 0.03 * (frame > garanta + 20 ? 1 : 0);
  const logo = progress(frame, 0, 20);
  return (
    <AbsoluteFill style={{ background: palette.cream }}>
      <div
        style={{
          position: "absolute",
          left: 540 - 220,
          top: 1585,
          width: 440,
          height: 50,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(36,60,108,0.28), rgba(0,0,0,0))",
        }}
      />
      <Florals x={-40} y={1180} scale={1.05} rotate={-8} at={6} />
      <Florals x={840} y={1160} scale={0.95} rotate={8} flip at={12} />
      <div style={{ position: "absolute", top: 830 }}>
        <Bottle3D width={1080} height={800} rotation={frame / 55 + 2.6} tilt={0.05} zoom={1.12} />
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 120 }}>
        <CreditRow at={wordFrame("cta", "Garanta") + 20} />
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: `150px ${PAD}px`, alignItems: "center", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: logo,
            transform: `translateY(${(1 - logo) * 20}px)`,
          }}
        >
          <GateMark size={96} />
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 46, color: palette.navy, letterSpacing: -1 }}>
            Porteira do Céu
          </div>
        </div>
        <div style={{ height: 40 }} />
        <Line text="Agora na" at={wordFrame("cta", "Agora")} size={104} align="center" />
        <Line
          text="Porteira do Céu."
          at={wordFrame("cta", "Porteira")}
          size={104}
          align="center"
          color={palette.accent}
        />
        <div style={{ height: 50 }} />
        <div
          style={{
            transform: `scale(${btn * pulse})`,
            background: palette.navy,
            color: "#fff",
            fontFamily: display,
            fontWeight: 800,
            fontSize: 52,
            padding: "30px 64px",
            borderRadius: 999,
            boxShadow: "0 16px 40px rgba(36,60,108,0.35)",
          }}
        >
          Garanta a sua →
        </div>
        <div style={{ height: 34 }} />
        <Kicker
          text="Caminho da Fé · 600 ml · térmica"
          at={garanta + 12}
          color={palette.muted}
          size={24}
          align="center"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- montagem ---------- */
const SCENES = { hook: Hook, marca: Marca, caminho: Caminho, arte: Arte, recursos: Recursos, atelie: Atelie, cta: Cta };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRESENTATIONS: TransitionPresentation<any>[] = [
  circle(),
  slide({ direction: "from-bottom" }),
  circle({ x: 30, y: 60 }),
  slide({ direction: "from-right" }),
  circle({ x: 50, y: 50 }),
  fade(),
];

export type V3Props = { narration: boolean };

export const V3: React.FC<V3Props> = ({ narration }) => {
  const { durationInFrames } = useVideoConfig();
  const music = (f: number) => {
    const talking = narration && speechRanges.some((r) => f >= r.from - 6 && f <= r.to + 6);
    const base = narration ? 0.5 : 0.95;
    const out = interpolate(f, [durationInFrames - 50, durationInFrames - 2], [1, 0], clamp);
    return (talking ? base * 0.42 : base) * out;
  };
  return (
    <AbsoluteFill style={{ background: palette.cream }}>
      <TransitionSeries>
        {segments.flatMap((s, i) => {
          const Scene = SCENES[s.id];
          const seq = (
            <TransitionSeries.Sequence key={s.id} durationInFrames={sceneFrames[i]}>
              <Scene />
            </TransitionSeries.Sequence>
          );
          if (i === 0) return [seq];
          const timing =
            i === 3 || i === 1
              ? springTiming({ config: { damping: 200 }, durationInFrames: T })
              : linearTiming({ durationInFrames: T });
          return [
            <TransitionSeries.Transition key={`t${i}`} presentation={PRESENTATIONS[i - 1]} timing={timing} />,
            seq,
          ];
        })}
      </TransitionSeries>
      <Grain />

      <Audio src={staticFile("v3/music.wav")} volume={music} />
      {narration &&
        segments.map((s, i) => (
          <Sequence key={s.id} from={sceneStarts[i] + LEAD_FRAMES} layout="none">
            <Audio src={staticFile(s.file)} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
