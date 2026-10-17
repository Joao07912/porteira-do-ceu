import { useId } from "react";
import { Easing, interpolate } from "remotion";

/*
 * Peregrino articulado (silhueta com luz de contorno).
 * - pernas com IK de 2 ossos e pés travados no chão (calcanhar → planta → ponta)
 * - pelve, coluna, pescoço e cabeça com movimento secundário
 * - cajado fincado no chão pela mão de trás
 * - ação de beber: para, pega a garrafa do cinto, bebe e devolve
 * Origem = chão sob o quadril; y para baixo; olha para +x.
 */

type V = { x: number; y: number };
const v = (x: number, y: number): V => ({ x, y });
const add = (a: V, b: V) => v(a.x + b.x, a.y + b.y);
const sub = (a: V, b: V) => v(a.x - b.x, a.y - b.y);
const mul = (a: V, k: number) => v(a.x * k, a.y * k);
const len = (a: V) => Math.hypot(a.x, a.y);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V, b: V, t: number) => v(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const deg = Math.PI / 180;
const dir = (angleDeg: number) => v(Math.cos(angleDeg * deg), Math.sin(angleDeg * deg)); // 0 = +x, 90 = para baixo
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (x: number, a: number, b: number) => smooth(clamp01((x - a) / (b - a)));

const THIGH = 98;
const SHIN = 94;
const UPPER = 68;
const FORE = 62;
const STANCE = 0.6;

// IK de 2 ossos: bend = +1 dobra no sentido horário (cotovelo pra trás), -1 anti-horário (joelho pra frente)
const ik = (root: V, target: V, l1: number, l2: number, bend: 1 | -1) => {
  const d0 = sub(target, root);
  const d = Math.min(Math.max(len(d0), Math.abs(l1 - l2) + 0.5), l1 + l2 - 0.01);
  const base = Math.atan2(d0.y, d0.x);
  const off = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const a = base + bend * off;
  const joint = add(root, v(Math.cos(a) * l1, Math.sin(a) * l1));
  const end = add(root, mul(v(Math.cos(base), Math.sin(base)), d));
  return { joint, end };
};

/* ---------- pé ---------- */
type Foot = { ankle: V; heel: V; ball: V; toe: V; d: V; u: V; dt: V };
const footFrame = (theta: number) => {
  const d = dir(-theta); // theta > 0 = ponta pra cima
  return { d, u: v(d.y, -d.x) };
};
const footFromHeel = (heel: V, theta: number): Foot => {
  const { d, u } = footFrame(theta);
  const ball = add(heel, mul(d, 38));
  return { heel, ball, toe: add(ball, mul(d, 15)), ankle: add(add(heel, mul(d, 12)), mul(u, 11)), d, u, dt: d };
};
const footFromBall = (ball: V, theta: number): Foot => {
  const { d, u } = footFrame(theta);
  const heel = sub(ball, mul(d, 38));
  const dt = v(1, 0); // dedos ficam no chão enquanto o calcanhar sobe
  return { heel, ball, toe: add(ball, mul(dt, 15)), ankle: add(add(heel, mul(d, 12)), mul(u, 11)), d, u, dt };
};

// pé de uma perna na fase p (0 = calcanhar tocando o chão), passada a, elevação lift
const footAt = (p: number, a: number, lift: number, base: number): Foot => {
  const u = ((p % 1) + 1) % 1;
  if (u < STANCE) {
    const s = u / STANCE;
    const x = base + a - 2 * a * s; // ponto de referência desliza pra trás junto com o chão
    if (s < 0.14) return footFromHeel(v(x - 6, 0), lerp(15, 0, smooth(s / 0.14)) * Math.min(1, a / 20 + 0.2));
    if (s < 0.62) return footFromHeel(v(x - 6, 0), 0);
    return footFromBall(v(x + 32, 0), -lerp(0, 34, smooth((s - 0.62) / 0.38)) * Math.min(1, a / 20 + 0.1));
  }
  const s = (u - STANCE) / (1 - STANCE);
  const start = footAt(STANCE - 1e-6, a, lift, base);
  const end = footAt(0, a, lift, base);
  const k = Easing.inOut(Easing.cubic)(s);
  const ankle = lerpV(start.ankle, end.ankle, k);
  ankle.y -= Math.sin(Math.PI * Math.pow(s, 0.8)) * lift;
  const theta = interpolate(s, [0, 0.35, 0.75, 1], [-34, -12, 4, 15]) * Math.min(1, a / 20 + 0.1);
  const { d, u: up } = footFrame(theta);
  const heel = sub(sub(ankle, mul(up, 11)), mul(d, 12));
  const ball = add(heel, mul(d, 38));
  const dt = footFrame(theta + interpolate(s, [0, 0.3], [34, 0], { extrapolateRight: "clamp" }) * (a > 5 ? 1 : 0)).d;
  return { heel, ball, toe: add(ball, mul(dt, 15)), ankle, d, u: up, dt };
};

/* ---------- desenho ---------- */
// contorno suave fechado (Catmull-Rom → Bézier)
const blob = (pts: V[]) => {
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + " Z";
};

// membro orgânico: larguras nas pontas e barriga de músculo em cada lado
const limb = (a: V, b: V, w1: number, w2: number, back: number, front: number) => {
  const dd = sub(b, a);
  const L = len(dd) || 1;
  const t = mul(dd, 1 / L);
  const n = v(-t.y, t.x);
  const side = (k: number, w: number, s: 1 | -1) => add(add(a, mul(t, L * k)), mul(n, w * s));
  const wm = (w1 + w2) / 2;
  return blob([
    side(-0.06, w1 * 0.7, 1),
    side(0.12, w1, 1),
    side(0.45, wm + back, 1),
    side(0.85, w2, 1),
    side(1.06, w2 * 0.6, 1),
    side(1.06, w2 * 0.6, -1),
    side(0.85, w2, -1),
    side(0.45, wm + front, -1),
    side(0.12, w1, -1),
    side(-0.06, w1 * 0.7, -1),
  ]);
};

// pontos num referencial local (ao longo, para o lado)
const frame = (o: V, upDeg: number) => {
  const up = dir(upDeg);
  const fw = v(-up.y, up.x); // perpendicular apontando pra frente quando up = -90
  return (along: number, side: number) => add(add(o, mul(up, along)), mul(fw, side));
};

const Boot: React.FC<{ f: Foot; ink: string; detail: string }> = ({ f, ink, detail }) => {
  const { ankle, heel, ball, toe, d, u, dt } = f;
  const ut = v(dt.y, -dt.x);
  const p = [
    add(add(ankle, mul(d, -12)), mul(u, 16)),
    add(add(ankle, mul(d, 10)), mul(u, 15)),
    add(add(ball, mul(d, -8)), mul(u, 15)),
    add(add(ball, mul(dt, 6)), mul(ut, 11)),
    add(add(toe, mul(dt, 2)), mul(ut, 6)),
    add(toe, mul(dt, 1)),
    add(ball, mul(u, -1)),
    add(heel, mul(u, -1)),
    add(add(heel, mul(d, -4)), mul(u, 6)),
  ];
  const lace1 = add(add(ankle, mul(d, 12)), mul(u, 8));
  const lace2 = add(add(ball, mul(d, -10)), mul(u, 10));
  return (
    <g>
      <path d={blob(p)} fill={ink} />
      <path d={`M ${heel.x} ${heel.y - 2} L ${ball.x} ${ball.y - 2} L ${toe.x} ${toe.y - 2}`} stroke={detail} strokeWidth={3} fill="none" />
      <path d={`M ${lace1.x} ${lace1.y} L ${lace2.x} ${lace2.y}`} stroke={detail} strokeWidth={2} strokeDasharray="3 4" />
    </g>
  );
};

export type PilgrimPose = ReturnType<typeof posePilgrim>;

export const posePilgrim = ({ t, w, drink, frame: fr }: { t: number; w: number; drink: number; frame: number }) => {
  const a = 60 * w; // meia passada
  const lift = 24 * w;
  const nearFoot = footAt(t, a, lift, 6);
  const farFoot = footAt(t + 0.5, a, lift, -8);

  // quadril: sobe no meio do apoio; nunca alto demais pra perna alcançar
  const bob = Math.cos(4 * Math.PI * (t - 0.3)) * 4 * w;
  const reach = (f: Foot, hx: number) => f.ankle.y - Math.sqrt(Math.max(0, (THIGH + SHIN - 3) ** 2 - (f.ankle.x - hx) ** 2));
  const hipX = 0;
  const hipY = Math.max(-197 - bob - 3 * (1 - w), reach(nearFoot, hipX + 4), reach(farFoot, hipX - 4));
  const breath = Math.sin(fr / 22) * (1 - w);
  const pelvis = v(hipX, hipY + breath * 1.2);

  const lean = 8 * w + 2 + breath * 0.8 + Math.sin(4 * Math.PI * t) * 1.2 * w - 9 * ramp(drink, 0.25, 0.4) * (1 - ramp(drink, 0.7, 0.85));
  const spineUp = -90 + lean;
  const S = frame(pelvis, spineUp);
  const chest = S(80, 0);
  const neckBase = S(124, 2);
  const shoulder = S(112, -4);

  // cabeça estabilizada + inclinação ao beber
  const sip = ramp(drink, 0.3, 0.42) * (1 - ramp(drink, 0.68, 0.8));
  const headUp = spineUp - lean * 0.7 - 24 * sip + Math.sin(4 * Math.PI * t + 1) * 1.5 * w;
  const headC = add(neckBase, mul(dir(headUp), 26));
  const H = frame(headC, headUp);

  // pernas
  const hipNear = add(pelvis, v(4, 0));
  const hipFar = add(pelvis, v(-4, 0));
  const legNear = ik(hipNear, nearFoot.ankle, THIGH, SHIN, -1);
  const legFar = ik(hipFar, farFoot.ankle, THIGH, SHIN, -1);

  // cajado (mão de trás): ponta fincada enquanto o corpo passa
  const sp = (((t % 1) + 1) % 1);
  const plant = 0.55;
  let tip: V;
  if (sp < plant) {
    tip = v(lerp(64, -40, sp / plant) * w + 34 * (1 - w), 0);
  } else {
    const s = (sp - plant) / (1 - plant);
    tip = v(lerp(-40, 64, Easing.inOut(Easing.quad)(s)) * w + 34 * (1 - w), -Math.sin(Math.PI * s) * 18 * w);
  }
  const shoulderFar = add(shoulder, v(-6, 2));
  const grip0 = add(shoulderFar, v(40 + 10 * w * Math.sin(2 * Math.PI * t), 58));
  const staffDir = mul(sub(grip0, tip), 1 / len(sub(grip0, tip)));
  const grip = add(tip, mul(staffDir, Math.min(len(sub(grip0, tip)), 190)));
  const staffTop = add(grip, mul(staffDir, 150));
  const armFar = ik(shoulderFar, grip, UPPER, FORE, 1);

  // braço da frente: balanço natural ou ação de beber
  const swing = 16 * w * Math.cos(2 * Math.PI * (t + 0.5) - 0.35);
  const upperDir = 90 - swing;
  const elbowW = add(shoulder, mul(dir(upperDir), UPPER));
  const handWalk = add(elbowW, mul(dir(upperDir - 14 - Math.max(0, swing) * 1.4), FORE));

  const beltAnchor = S(14, 24);
  const pend = Math.sin(4 * Math.PI * t - 0.8) * 9 * w + Math.sin(fr / 9) * 1.5;
  const mouth = H(-8, 24);
  const atMouth = add(mouth, v(26, 8));
  const grabW = ramp(drink, 0.04, 0.2) * (1 - ramp(drink, 0.9, 1));
  const toMouth = ramp(drink, 0.2, 0.38) * (1 - ramp(drink, 0.72, 0.88));
  const hanging = add(beltAnchor, mul(dir(90 - pend), 34));
  const handTarget = lerpV(lerpV(handWalk, hanging, grabW), atMouth, toMouth);
  const armNear = ik(shoulder, handTarget, UPPER, FORE, 1);
  const held = grabW > 0.98 || toMouth > 0;
  const bottleAngle = held ? -112 * toMouth + Math.sin(fr / 5) * 4 * sip : -pend;
  const bottleCenter = held ? add(armNear.end, mul(dir(bottleAngle - 90), -2)) : hanging;

  return {
    nearFoot,
    farFoot,
    pelvis,
    S,
    H,
    chest,
    neckBase,
    shoulder,
    shoulderFar,
    headUp,
    lean,
    legNear,
    legFar,
    hipNear,
    hipFar,
    tip,
    staffTop,
    armFar,
    armNear,
    beltAnchor,
    bottleCenter,
    bottleAngle,
    held,
    // velocidade do chão (unidades por fase) — o corpo avança 2a/STANCE a cada ciclo
    stride: (2 * a) / STANCE,
  };
};

const Bottle: React.FC<{ c: V; angle: number; glow: number }> = ({ c, angle, glow }) => (
  <g transform={`translate(${c.x} ${c.y}) rotate(${angle})`}>
    <rect x={-11} y={-34} width={22} height={60} rx={7} fill="#f2eee6" />
    <rect x={-11} y={-20} width={22} height={34} fill="#d9873f" />
    <rect x={-11} y={-6} width={22} height={5} fill="#2b4c8a" />
    <rect x={-11} y={6} width={22} height={6} fill="#5c7a3a" />
    <rect x={-11} y={-34} width={6} height={60} rx={3} fill="rgba(255,255,255,0.55)" />
    <rect x={-9} y={-43} width={18} height={10} rx={2} fill="#111" />
    <rect x={-4} y={-50} width={8} height={8} rx={2} fill="#111" />
    {glow > 0 && <rect x={-20} y={-58} width={40} height={94} rx={16} fill="none" stroke="#ffe3a6" strokeWidth={4} opacity={glow} />}
  </g>
);

export const Pilgrim: React.FC<{
  pose: PilgrimPose;
  frame: number;
  height: number;
  bottleGlow?: number;
  ink?: string;
  rimColor?: string;
  style?: React.CSSProperties;
}> = ({ pose: P, frame: fr, height, bottleGlow = 0, ink = "#1c1411", rimColor = "#ffb877", style }) => {
  const id = useId().replace(/:/g, "");
  const back = "#130d0b";
  const detail = "#3a2a22";
  const S = P.S;
  const H = P.H;

  const torso = blob([
    S(-6, -22),
    S(-10, 4),
    S(-4, 24),
    S(36, 28),
    S(84, 27),
    S(114, 20),
    S(126, 6),
    S(124, -12),
    S(108, -25),
    S(56, -27),
    S(10, -25),
  ]);
  const pack = blob([S(26, -22), S(24, -62), S(38, -80), S(100, -82), S(116, -66), S(120, -36), S(116, -20), S(70, -18)]);
  const roll = blob([S(116, -30), S(117, -84), S(134, -85), S(135, -29)]);
  const head = blob([
    H(4, -22),
    H(22, -12),
    H(24, 6),
    H(14, 18),
    H(6, 21),
    H(1, 22),
    H(-5, 29),
    H(-9, 22),
    H(-13, 22),
    H(-24, 19),
    H(-30, 6),
    H(-22, -10),
    H(-10, -20),
  ]);
  const brim = blob([H(13, -40), H(17, -6), H(16, 30), H(13, 46), H(9, 46), H(10, 10), H(8, -38)]);
  const crown = blob([H(14, -24), H(30, -22), H(38, -8), H(39, 10), H(33, 22), H(14, 24)]);
  const flutter = (k: number) => Math.sin(fr / 4 + k) * (5 + k * 2);
  const nb = P.neckBase;
  const scarf = `M ${nb.x - 4} ${nb.y + 6} Q ${nb.x - 30} ${nb.y + 4 + flutter(0)} ${nb.x - 56} ${nb.y + 14 + flutter(1)} Q ${nb.x - 70} ${nb.y + 22 + flutter(2)} ${nb.x - 80} ${nb.y + 30 + flutter(2.5)} L ${nb.x - 46} ${nb.y + 26 + flutter(1.2)} Q ${nb.x - 22} ${nb.y + 22} ${nb.x - 2} ${nb.y + 18} Z`;
  const strap = `M ${S(112, -18).x} ${S(112, -18).y} Q ${S(104, 14).x} ${S(104, 14).y} ${S(60, 22).x} ${S(60, 22).y}`;

  const nearHand = P.armNear.end;
  const farHand = P.armFar.end;

  return (
    <svg viewBox="-210 -440 420 460" height={height} width={(height * 420) / 460} style={{ overflow: "visible", ...style }}>
      <defs>
        <filter id={`rim-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feOffset in="SourceAlpha" dx={-3.5} dy={1} result="off" />
          <feComposite in="SourceAlpha" in2="off" operator="out" result="edge" />
          <feFlood floodColor={rimColor} />
          <feComposite in2="edge" operator="in" result="rim" />
          <feGaussianBlur in="rim" stdDeviation={0.7} result="rimb" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="rimb" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx={0} cy={3} rx={90} ry={6} fill="rgba(0,0,0,0.28)" />
      <g filter={`url(#rim-${id})`}>
        {/* cajado */}
        <line x1={P.tip.x} y1={P.tip.y} x2={P.staffTop.x} y2={P.staffTop.y} stroke="#2a1b12" strokeWidth={7} strokeLinecap="round" />
        {/* lado de trás */}
        <path d={limb(P.shoulderFar, P.armFar.joint, 13, 10, 2, 1)} fill={back} />
        <path d={limb(P.armFar.joint, farHand, 10, 8, 2, 1)} fill={back} />
        <circle cx={farHand.x} cy={farHand.y} r={10} fill={back} />
        <path d={limb(P.hipFar, P.legFar.joint, 20, 14, 2, 4)} fill={back} />
        <path d={limb(P.legFar.joint, P.farFoot.ankle, 14, 10, 4, 0)} fill={back} />
        <Boot f={P.farFoot} ink={back} detail="#2a1f1a" />

        {/* mochila */}
        <path d={roll} fill={ink} />
        <path d={`M ${S(116, -44).x} ${S(116, -44).y} L ${S(135, -44).x} ${S(135, -44).y} M ${S(116, -70).x} ${S(116, -70).y} L ${S(135, -70).x} ${S(135, -70).y}`} stroke={detail} strokeWidth={3} />
        <path d={pack} fill={ink} />
        <path d={`M ${S(92, -24).x} ${S(92, -24).y} Q ${S(96, -52).x} ${S(96, -52).y} ${S(110, -76).x} ${S(110, -76).y}`} stroke={detail} strokeWidth={3} fill="none" />
        <path d={blob([S(44, -76), S(44, -94), S(80, -95), S(84, -78)])} fill={ink} />
        <path d={`M ${S(44, -80).x} ${S(44, -80).y} L ${S(84, -80).x} ${S(84, -80).y}`} stroke={detail} strokeWidth={2.5} />

        {/* tronco */}
        <path d={torso} fill={ink} />
        <path d={strap} stroke={detail} strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d={`M ${S(10, -24).x} ${S(10, -24).y} L ${S(12, 27).x} ${S(12, 27).y}`} stroke={detail} strokeWidth={5} />
        <path d={`M ${S(118, 18).x} ${S(118, 18).y} L ${S(22, 26).x} ${S(22, 26).y}`} stroke={detail} strokeWidth={2} strokeDasharray="2 5" />
        <path d={scarf} fill={ink} />

        {/* cabeça */}
        <path d={blob([P.neckBase, add(P.neckBase, v(8, -4)), H(-16, 8), H(-12, -16)])} fill={ink} />
        <path d={head} fill={ink} />
        <path d={crown} fill={ink} />
        <path d={brim} fill={ink} />
        <path d={`M ${H(17, -24).x} ${H(17, -24).y} L ${H(17, 24).x} ${H(17, 24).y}`} stroke={detail} strokeWidth={4} />
        <path d={`M ${H(4, -4).x} ${H(4, -4).y} Q ${H(-2, -8).x} ${H(-2, -8).y} ${H(-6, -2).x} ${H(-6, -2).y}`} stroke={detail} strokeWidth={2} fill="none" />

        {/* garrafa pendurada no cinto */}
        {!P.held && (
          <>
            <line x1={P.beltAnchor.x} y1={P.beltAnchor.y} x2={P.bottleCenter.x} y2={P.bottleCenter.y - 44} stroke="#b9bec2" strokeWidth={3} />
            <Bottle c={P.bottleCenter} angle={P.bottleAngle} glow={bottleGlow} />
          </>
        )}

        {/* perna da frente */}
        <path d={limb(P.hipNear, P.legNear.joint, 21, 15, 2, 5)} fill={ink} />
        <path d={limb(P.legNear.joint, P.nearFoot.ankle, 15, 10, 5, 0)} fill={ink} />
        <path
          d={`M ${P.legNear.joint.x - 10} ${P.legNear.joint.y - 18} q 8 10 22 4`}
          stroke={detail}
          strokeWidth={2}
          fill="none"
        />
        <Boot f={P.nearFoot} ink={ink} detail={detail} />

        {/* braço da frente (+ garrafa na mão) */}
        <path d={limb(P.shoulder, P.armNear.joint, 14, 11, 2, 2)} fill={ink} />
        <path d={limb(P.armNear.joint, nearHand, 11, 8, 2, 1)} fill={ink} />
        {P.held && <Bottle c={P.bottleCenter} angle={P.bottleAngle} glow={bottleGlow} />}
        <circle cx={nearHand.x} cy={nearHand.y} r={10} fill={ink} />
        <circle cx={nearHand.x + 6} cy={nearHand.y - 6} r={5} fill={ink} />
      </g>
    </svg>
  );
};
