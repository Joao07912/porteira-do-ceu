import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { colors, copy, sans, serif } from "./theme";

const T = 15; // duração das transições (frames)
const INTRO = 150;
const PILGRIM = 225;
const FEATURES = 330;
const CTA = 180;
export const PROMO_DURATION = INTRO + PILGRIM + FEATURES + CTA - 3 * T;

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={INTRO}>
          <Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence durationInFrames={PILGRIM}>
          <Pilgrim />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence durationInFrames={FEATURES}>
          <Features />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence durationInFrames={CTA}>
          <CallToAction />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Grain />
    </AbsoluteFill>
  );
};

/* ---------- helpers ---------- */

const ease = Easing.bezier(0.22, 1, 0.36, 1);

const Reveal: React.FC<{ delay: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px)`,
        filter: `blur(${(1 - p) * 8}px)`,
        textWrap: "balance",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Headline: React.FC<{ lines: string[]; delay?: number; gap?: number }> = ({ lines, delay = 0, gap = 18 }) => (
  <div style={{ textAlign: "center" }}>
    {lines.map((line, i) => (
      <Reveal key={line} delay={delay + i * gap}>
        <div
          style={{
            fontFamily: serif,
            fontWeight: 700,
            fontSize: 92,
            lineHeight: 1.08,
            color: colors.cream,
            textShadow: "0 4px 30px rgba(0,0,0,0.6)",
          }}
        >
          {line}
        </div>
      </Reveal>
    ))}
  </div>
);

const Shade: React.FC<{ from?: number; to?: number; side?: "top" | "bottom" }> = ({ from = 0, to = 0.75, side = "bottom" }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(to ${side}, rgba(18,11,5,${from}) 35%, rgba(18,11,5,${to}) 100%)`,
    }}
  />
);

const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)",
    }}
  />
);

/* ---------- cenas ---------- */

// Foto1 é horizontal: atravessa do pôr do sol (direita) até as garrafas (esquerda).
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const imgW = (1920 / 900) * 1600; // altura preenchida, largura proporcional
  const x = interpolate(frame, [0, durationInFrames], [-(imgW - 1080), -60], { easing: Easing.inOut(Easing.cubic) });
  const scale = interpolate(frame, [0, durationInFrames], [1.08, 1]);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile("Foto1.jpeg")}
        style={{ position: "absolute", height: 1920, width: imgW, left: x, transform: `scale(${scale})` }}
      />
      <Shade side="top" from={0} to={0.7} />
      <AbsoluteFill style={{ justifyContent: "flex-start", paddingTop: 300 }}>
        <Headline lines={copy.intro} delay={15} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Pilgrim: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, PILGRIM], [1.05, 1.15]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <OffthreadVideo
          src={staticFile("Foto3.mp4")}
          muted
          playbackRate={0.8}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <Shade from={0} to={0.8} />
      <AbsoluteFill style={{ justifyContent: "flex-end", paddingBottom: 260 }}>
        <Headline lines={copy.pilgrim} delay={110} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const FeatureCard: React.FC<{ index: number; title: string; text: string; start: number; length: number }> = ({
  index,
  title,
  text,
  start,
  length,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - start;
  const enter = spring({ frame: local, fps, config: { damping: 200 } });
  const exit = interpolate(local, [length - 15, length], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (local < 0 || local > length) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom: 260,
        opacity: enter * (1 - exit),
        transform: `translateX(${(1 - enter) * -120 + exit * 120}px)`,
        display: "flex",
        gap: 36,
        alignItems: "center",
        padding: "44px 48px",
        borderRadius: 36,
        background: "rgba(18,11,5,0.62)",
        border: `2px solid ${colors.gold}55`,
        backdropFilter: "blur(14px)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: colors.blue,
          border: `3px solid ${colors.gold}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: serif,
          fontWeight: 700,
          fontSize: 64,
          color: colors.gold,
        }}
      >
        {index + 1}
      </div>
      <div>
        <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 68, color: colors.gold, lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 36, color: colors.cream, marginTop: 10, lineHeight: 1.3 }}>
          {text}
        </div>
      </div>
    </div>
  );
};

const Features: React.FC = () => {
  const frame = useCurrentFrame();
  const slot = Math.floor((FEATURES - 30) / copy.features.length);
  // zoom ancorado no topo-esquerdo esconde a marca d'água do canto inferior direito
  const scale = interpolate(frame, [0, FEATURES], [1.14, 1.22]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "30% 20%" }}>
        <OffthreadVideo
          src={staticFile("Foto4.mp4")}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <Shade from={0} to={0.75} />
      {copy.features.map((f, i) => (
        <FeatureCard key={f.title} index={i} title={f.title} text={f.text} start={20 + i * slot} length={slot - 5} />
      ))}
    </AbsoluteFill>
  );
};

const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const imgW = (1920 / 900) * 1600;
  const scale = interpolate(frame, [0, CTA], [1.12, 1.02]);
  const storePop = spring({ frame: frame - 25, fps, config: { damping: 12, mass: 0.8 } });
  const line = interpolate(frame, [45, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill>
      <Img
        src={staticFile("Foto1.jpeg")}
        style={{
          position: "absolute",
          height: 1920,
          width: imgW,
          left: -40,
          transform: `scale(${scale})`,
          transformOrigin: "20% 60%",
        }}
      />
      <AbsoluteFill style={{ background: "rgba(18,11,5,0.45)" }} />
      <Shade side="top" from={0.1} to={0.85} />
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 260, textAlign: "center" }}>
        <Reveal delay={8}>
          <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 42, letterSpacing: 6, textTransform: "uppercase", color: colors.cream }}>
            {copy.ctaTop}
          </div>
        </Reveal>
        <div
          style={{
            marginTop: 24,
            fontFamily: serif,
            fontWeight: 700,
            fontSize: 150,
            lineHeight: 1,
            color: colors.gold,
            textShadow: "0 6px 40px rgba(0,0,0,0.7)",
            transform: `scale(${storePop})`,
            opacity: Math.min(1, storePop),
          }}
        >
          {copy.store}
        </div>
        <div style={{ marginTop: 36, height: 4, width: 420 * line, background: colors.gold, borderRadius: 2 }} />
        <Reveal delay={70} style={{ marginTop: 40, padding: "0 90px" }}>
          <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 62, color: colors.cream, lineHeight: 1.2 }}>
            {copy.ctaBottom}
          </div>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 200 }}>
        <Reveal delay={95}>
          <div
            style={{
              fontFamily: sans,
              fontWeight: 700,
              fontSize: 44,
              color: colors.cream,
              background: colors.blue,
              border: `3px solid ${colors.gold}`,
              padding: "22px 54px",
              borderRadius: 999,
            }}
          >
            {copy.contact}
          </div>
        </Reveal>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
