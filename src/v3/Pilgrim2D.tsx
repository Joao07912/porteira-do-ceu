import { useId } from "react";
import { Easing, Img, interpolate, staticFile } from "remotion";

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
      <path
        d={`M ${heel.x} ${heel.y - 2} L ${ball.x} ${ball.y - 2} L ${toe.x} ${toe.y - 2}`}
        stroke={detail}
        strokeWidth={3}
        fill="none"
      />
      <path
        d={`M ${lace1.x} ${lace1.y} L ${lace2.x} ${lace2.y}`}
        stroke={detail}
        strokeWidth={2}
        strokeDasharray="3 4"
      />
    </g>
  );
};

export type PilgrimPose = ReturnType<typeof posePilgrim>;

// interpolação por keyframes com ease-in-out em cada trecho
const keys = (x: number, ks: number[], vs: number[]) =>
  interpolate(x, ks, vs, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
const keysV = (x: number, ks: number[], ps: V[]) =>
  v(
    keys(
      x,
      ks,
      ps.map((p) => p.x),
    ),
    keys(
      x,
      ks,
      ps.map((p) => p.y),
    ),
  );
// vetor "para cima" da garrafa desenhada com rotate(angle)
const bottleUp = (angle: number) => v(Math.sin(angle * deg), -Math.cos(angle * deg));

// momentos da ação de beber (0..1)
const D = [0, 0.1, 0.16, 0.26, 0.36, 0.56, 0.64, 0.7, 0.8, 0.87, 0.92, 1];
const HELD_FROM = D[1];
const HELD_TO = D[10];

export const posePilgrim = ({ t, w, drink, frame: fr }: { t: number; w: number; drink: number; frame: number }) => {
  const a = 60 * w; // meia passada
  const lift = 24 * w;
  const nearFoot = footAt(t, a, lift, 8);
  const farFoot = footAt(t + 0.5, a, lift, -10);
  const cyc = 2 * Math.PI * t;

  // quadril: sobe no meio do apoio; antecipação (dobra os joelhos) ao pegar e prender a garrafa
  const bob = Math.cos(2 * cyc - 2 * Math.PI * 0.6) * 4 * w;
  const dip = keys(drink, D, [0, 5, 3, 0, 0, 0, 0, 0, 0, 5, 2, 0]);
  const reach = (f: Foot, hx: number) =>
    f.ankle.y - Math.sqrt(Math.max(0, (THIGH + SHIN - 3) ** 2 - (f.ankle.x - hx) ** 2));
  const pelvisTurn = 5 * Math.sin(cyc) * w; // pelve gira junto com a perna que avança
  const hipNear0 = v(4 + pelvisTurn, 0);
  const hipFar0 = v(-4 - pelvisTurn, 0);
  const hipY = Math.max(-197 - bob - 3 * (1 - w) + dip, reach(nearFoot, hipNear0.x), reach(farFoot, hipFar0.x));
  const breath = Math.sin(fr / 22) * (1 - w);
  const pelvis = v(0, hipY + breath * 1.2);

  // tronco: inclina pra frente andando, pra trás ao beber
  const lean =
    8 * w + 2 + breath * 0.8 + Math.sin(2 * cyc) * 1.2 * w + keys(drink, D, [0, 4, 3, -1, -6, -9, -4, 1, 1, 4, 2, 0]);
  const spineUp = -90 + lean;
  const S = frame(pelvis, spineUp);
  const chest = S(80, 0);
  const neckBase = S(124, 2);
  const counter = -3.5 * Math.sin(cyc) * w; // ombros em contraposição à pelve
  const shoulder = S(112, -4 + counter);
  const shoulderFar = S(110, -10 - counter);

  // cabeça: estabilizada na caminhada; olha pra garrafa, inclina pra beber, goles
  const gulps =
    Math.sin(((drink - D[4]) / (D[5] - D[4])) * Math.PI * 6) *
    2.2 *
    ramp(drink, D[4], D[4] + 0.03) *
    (1 - ramp(drink, D[5] - 0.03, D[5]));
  const look = keys(drink, D, [0, 16, 12, 2, -20, -30, -10, 14, 16, 16, 6, 0]);
  const headUp = spineUp - lean * 0.75 + look + gulps + Math.sin(2 * cyc + 1) * 1.5 * w;
  const headC = add(neckBase, mul(dir(headUp), 26));
  const H = frame(headC, headUp);

  // pernas
  const hipNear = add(pelvis, hipNear0);
  const hipFar = add(pelvis, hipFar0);
  const legNear = ik(hipNear, nearFoot.ankle, THIGH, SHIN, -1);
  const legFar = ik(hipFar, farFoot.ankle, THIGH, SHIN, -1);

  // cajado (mão de trás): ponta fincada enquanto o corpo passa
  const sp = ((t % 1) + 1) % 1;
  const plant = 0.55;
  let tip: V;
  if (sp < plant) {
    tip = v(lerp(64, -40, sp / plant) * w + 40 * (1 - w), 0);
  } else {
    const s = (sp - plant) / (1 - plant);
    tip = v(lerp(-40, 64, Easing.inOut(Easing.quad)(s)) * w + 40 * (1 - w), -Math.sin(Math.PI * s) * 18 * w);
  }
  const grip0 = add(shoulderFar, v(40 + 10 * w * Math.sin(cyc), 58));
  const staffDir = mul(sub(grip0, tip), 1 / len(sub(grip0, tip)));
  const grip = add(tip, mul(staffDir, Math.min(len(sub(grip0, tip)), 190)));
  const staffTop = add(grip, mul(staffDir, 150));
  const armFar = ik(shoulderFar, grip, UPPER, FORE, 1);

  // braço da frente andando: ombro → cotovelo com atraso → punho com mais atraso
  const swing = 17 * w * Math.cos(cyc + Math.PI - 0.3);
  const upperDir = 90 - swing;
  const elbowW = add(shoulder, mul(dir(upperDir), UPPER));
  const foreDir = upperDir - 12 - Math.max(0, 17 * w * Math.cos(cyc + Math.PI - 0.75)) * 1.5;
  const handWalk = add(elbowW, mul(dir(foreDir), FORE));

  // garrafa pendurada: pêndulo com o passo
  const beltAnchor = S(14, 24);
  const pend = Math.sin(2 * cyc - 0.8) * 9 * w + Math.sin(fr / 9) * 1.5;
  const hanging = add(beltAnchor, mul(dir(90 - pend), 34));
  // a mão segura a garrafa no terço de baixo (a estampa continua aparecendo)
  const GRIP = 25; // segura na base, deixando a estampa à mostra
  const gripOf = (center: V, ang: number) => sub(center, mul(bottleUp(ang), GRIP));
  const hangGrip = gripOf(hanging, -pend);

  // ação de beber: alvo da mão (centro da garrafa) e ângulo da garrafa em cada momento
  const angles = [-pend, 0, 0, -38, -104, -130, -60, -10, -6, 0, 0, -pend];
  const angle = keys(drink, D, angles) + gulps * 1.5;
  const mouth = H(-9, 25);
  const atMouth = (ang: number) => sub(mouth, mul(bottleUp(ang), 54 + GRIP));
  const handKeys = [
    handWalk,
    hangGrip,
    add(hangGrip, v(2, -8)), // puxão pra soltar do mosquetão
    S(72, 58), // arco à frente do peito
    atMouth(-104),
    atMouth(-130),
    S(84, 46),
    S(70, 40), // admira a garrafa na frente do peito
    S(72, 42),
    add(hangGrip, v(2, -6)),
    hangGrip,
    handWalk,
  ];
  const handTarget = drink <= 0 ? handWalk : keysV(drink, D, handKeys);
  const armNear = ik(shoulder, handTarget, UPPER, FORE, 1);
  const held = drink > HELD_FROM && drink < HELD_TO;
  const bottleAngle = held ? angle : -pend;
  const bottleCenter = held ? add(armNear.end, mul(bottleUp(angle), GRIP)) : hanging;

  // inércia: mochila e chapéu acompanham o corpo com atraso
  const packLag = v(0, Math.cos(2 * cyc - 2 * Math.PI * 0.6 - 1.0) * 3 * w + dip * 0.4);
  const packRot = Math.sin(2 * cyc - 1.4) * 1.6 * w;
  const hatLag = Math.sin(2 * cyc - 1.8) * 1.4 * w - gulps * 0.6;
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
    packLag,
    packRot,
    hatLag,
    headC,
  };
};

// garrafa pequena com a estampa real (Arte.jpg) cobrindo o corpo inteiro
const ART_W = 111; // largura da arte em unidades (comprimida como na sublimação)
// estampa desenhada em vetor (frente da garrafa, 260 x 640), fiel à arte da Porteira do Céu
const LabelArt: React.FC<{ id: string }> = ({ id }) => {
  const navy = "#24427a";
  const wood = "#8a5a32";
  const woodDark = "#5e3a1e";
  const plank = "#efe3c6";
  const leaf = (x: number, y: number, r: number, flip = 1) => (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip} 1)`} fill={navy}>
      <path d="M 0 0 L 34 0" stroke={navy} strokeWidth={2.5} />
      {[6, 14, 22, 30].map((k) => (
        <g key={k}>
          <ellipse cx={k} cy={-5} rx={4.5} ry={2.2} transform={`rotate(-35 ${k} -5)`} />
          <ellipse cx={k} cy={5} rx={4.5} ry={2.2} transform={`rotate(35 ${k} 5)`} />
        </g>
      ))}
    </g>
  );
  return (
    <g>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d98c4" />
          <stop offset="0.45" stopColor="#e9a86a" />
          <stop offset="0.8" stopColor="#f6c56f" />
          <stop offset="1" stopColor="#fbe0a0" />
        </linearGradient>
        <radialGradient id={`sun-${id}`}>
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.35" stopColor="#ffe9a8" stopOpacity={0.9} />
          <stop offset="1" stopColor="#ffd27a" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`grass-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c99a3e" />
          <stop offset="1" stopColor="#8a5f26" />
        </linearGradient>
      </defs>
      <rect width={260} height={640} fill="#f7f6f2" />
      {/* cena (subida pra porteira não ficar atrás da mão) */}
      <g transform="translate(0 -78)">
      <rect y={62} width={260} height={300} fill={`url(#sky-${id})`} />
      <ellipse cx={70} cy={150} rx={60} ry={9} fill="#f3c08a" opacity={0.7} />
      <ellipse cx={190} cy={120} rx={70} ry={10} fill="#efb98d" opacity={0.6} />
      <ellipse cx={210} cy={190} rx={50} ry={7} fill="#f6cf8f" opacity={0.7} />
      <circle cx={168} cy={300} r={70} fill={`url(#sun-${id})`} />
      <circle cx={168} cy={300} r={17} fill="#fff6d6" />
      <path d="M 0 300 Q 40 280 80 296 T 160 290 T 260 286 L 260 340 L 0 340 Z" fill="#8f7898" />
      <path d="M 0 322 Q 50 300 110 318 T 260 310 L 260 360 L 0 360 Z" fill="#6f8a55" />
      <path d="M 0 346 Q 70 330 140 344 T 260 338 L 260 380 L 0 380 Z" fill="#55703a" />
      <rect y={372} width={260} height={300} fill={`url(#grass-${id})`} />
      {/* árvore no canto esquerdo */}
      <path d="M -6 70 Q 30 90 22 160 L 30 380 L 6 380 L 4 170 Q 0 110 -6 100 Z" fill="#6a4426" />
      {[
        [10, 70, 34],
        [44, 62, 30],
        [78, 72, 26],
        [26, 100, 28],
        [60, 96, 22],
        [104, 66, 18],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#4f6b2c" : "#5d7a33"} />
      ))}
      {/* toco com suporte de ferro e sininho */}
      <rect x={34} y={250} width={24} height={300} rx={3} fill={wood} />
      <path d="M 40 262 L 42 540 M 51 258 L 50 545" stroke={woodDark} strokeWidth={2} />
      <path
        d="M 58 268 L 92 268 Q 104 268 104 282"
        stroke="#2a2522"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <path d="M 58 282 Q 74 282 74 272" stroke="#2a2522" strokeWidth={3} fill="none" />
      <path
        d="M 104 284 Q 92 284 92 300 Q 92 310 86 314 L 122 314 Q 116 310 116 300 Q 116 284 104 284 Z"
        fill="#d9a23c"
      />
      <path d="M 96 296 Q 97 289 102 288" stroke="#fbe2a0" strokeWidth={2.5} fill="none" />
      <circle cx={104} cy={320} r={4} fill="#a87a24" />
      {/* porteira azul com tábuas e a placa */}
      <rect x={58} y={392} width={14} height={160} fill={navy} />
      <rect x={250} y={392} width={14} height={160} fill={navy} />
      <rect x={66} y={400} width={194} height={30} rx={3} fill={plank} stroke="#b9a37c" strokeWidth={1.5} />
      <text
        x={163}
        y={421}
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight={700}
        fontSize={16}
        fill={navy}
      >
        PORTEIRA DO CÉU
      </text>
      {[446, 478, 510].map((y) => (
        <rect key={y} x={66} y={y} width={194} height={22} rx={2} fill={plank} stroke="#b9a37c" strokeWidth={1.5} />
      ))}
      <path d="M 74 540 L 160 438 L 250 540" stroke={navy} strokeWidth={11} fill="none" />
      <rect x={154} y={432} width={12} height={112} fill={navy} />
      {[
        [64, 410],
        [64, 530],
        [256, 410],
        [256, 530],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill="#1b1b1b" />
      ))}
      {/* Nossa Senhora Aparecida na borda direita */}
      <g transform="translate(236 228)">
        <path d="M 0 0 L 30 130 L -30 130 Z" fill="#3c63a8" />
        <path d="M 0 6 L 14 70 L -14 70 Z" fill="#6b4a2e" />
        <path d="M -12 130 L -12 96 Q 0 82 12 96 L 12 130 Z" fill="#f3efe4" />
        <path d="M -10 -4 L -8 -18 L -3 -10 L 0 -22 L 3 -10 L 8 -18 L 10 -4 Z" fill="#e2b13c" />
        <path d="M 0 -22 L 0 -32 M -4 -28 L 4 -28" stroke="#e2b13c" strokeWidth={2.5} />
      </g>
      {/* capim em primeiro plano */}
      {Array.from({ length: 18 }).map((_, i) => (
        <path
          key={i}
          d={`M ${i * 15} 650 q 3 -30 ${8 + (i % 3) * 3} -46 q -2 22 4 46 Z`}
          fill={i % 2 ? "#a77a2e" : "#c39440"}
        />
      ))}
      </g>
      {/* faixas brancas com a onda azul e as folhinhas (em cima e embaixo) */}
      <path d="M 0 0 L 260 0 L 260 52 Q 200 70 130 58 Q 60 46 0 66 Z" fill="#f7f6f2" />
      <path d="M 0 66 Q 60 46 130 58 Q 200 70 260 52" stroke={navy} strokeWidth={5} fill="none" />
      {leaf(96, 34, 0)}
      <path d="M 0 640 L 260 640 L 260 572 Q 190 590 120 578 Q 50 566 0 584 Z" fill="#f7f6f2" />
      <path d="M 0 584 Q 50 566 120 578 Q 190 590 260 572" stroke={navy} strokeWidth={5} fill="none" />
      {leaf(70, 612, 0)}
      {leaf(196, 612, 180, -1)}
    </g>
  );
};

const Bottle: React.FC<{ c: V; angle: number; glow: number }> = ({ c, angle, glow }) => {
  const id = useId().replace(/:/g, "");
  return (
    <g transform={`translate(${c.x} ${c.y}) rotate(${angle})`}>
      <defs>
        <clipPath id={`bb-${id}`}>
          <rect x={-13} y={-30} width={26} height={64} rx={6} />
        </clipPath>
        <linearGradient id={`bs-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.45} />
          <stop offset="0.2" stopColor="#000" stopOpacity={0.05} />
          <stop offset="0.32" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="0.42" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.75" stopColor="#000" stopOpacity={0.08} />
          <stop offset="1" stopColor="#000" stopOpacity={0.5} />
        </linearGradient>
      </defs>
      {/* ombro e corpo */}
      <path d="M -13 -26 Q -13 -36 -10 -38 L 10 -38 Q 13 -36 13 -26 Z" fill="#f1efea" />
      <rect x={-13} y={-30} width={26} height={64} rx={6} fill="#f1efea" />
      <g clipPath={`url(#bb-${id})`}>
        <g transform="translate(-13 -30) scale(0.1)">
          <LabelArt id={id} />
        </g>
        <rect x={-13} y={-38} width={26} height={72} fill={`url(#bs-${id})`} />
      </g>
      <path d="M -13 -26 Q -13 -36 -10 -38 L 10 -38 Q 13 -36 13 -26 Z" fill={`url(#bs-${id})`} />
      {/* tampa frisada, disco e bico */}
      <rect x={-10} y={-46} width={20} height={9} rx={1.5} fill="#151515" />
      {[-7, -3.5, 0, 3.5, 7].map((x) => (
        <rect key={x} x={x - 0.6} y={-45} width={1.2} height={7} fill="#2c2c2c" />
      ))}
      <rect x={-10.8} y={-49} width={21.6} height={4} rx={1.5} fill="#151515" />
      <rect x={-4.5} y={-56} width={9} height={8} rx={2} fill="#151515" />
      {/* alça + mosquetão */}
      <circle cx={-11} cy={-43} r={3.4} fill="none" stroke="#151515" strokeWidth={2} />
      <rect
        x={-17}
        y={-47}
        width={6}
        height={12}
        rx={3}
        fill="none"
        stroke="#c9ced2"
        strokeWidth={1.6}
        transform="rotate(-20 -14 -41)"
      />
      {glow > 0 && (
        <rect
          x={-22}
          y={-64}
          width={44}
          height={106}
          rx={16}
          fill="none"
          stroke="#ffe3a6"
          strokeWidth={4}
          opacity={glow}
        />
      )}
    </g>
  );
};
// mão: punho fechado orientado pelo antebraço; segurando a garrafa, os dedos envolvem o corpo dela
const Hand: React.FC<{ at: V; from: V; holding: number | null; ink: string; detail: string }> = ({
  at,
  from,
  holding,
  ink,
  detail,
}) => {
  if (holding === null) {
    const f = mul(sub(at, from), 1 / (len(sub(at, from)) || 1));
    const n = v(-f.y, f.x);
    const knuckle = add(at, mul(f, 6));
    const thumb = add(add(at, mul(f, 4)), mul(n, -8));
    return (
      <g fill={ink}>
        <path
          d={blob([
            add(at, mul(n, 9)),
            add(knuckle, mul(n, 8)),
            add(knuckle, mul(f, 7)),
            add(knuckle, mul(n, -8)),
            add(at, mul(n, -9)),
            sub(at, mul(f, 6)),
          ])}
        />
        <circle cx={thumb.x} cy={thumb.y} r={4.5} />
      </g>
    );
  }
  const up = bottleUp(holding);
  const p = v(-up.y, up.x);
  const fingers = [-7, -1, 5].map((k) => add(at, mul(up, k)));
  return (
    <g>
      {fingers.map((c, i) => (
        <path key={i} d={limb(sub(c, mul(p, 14)), add(c, mul(p, 12)), 3.6, 3.2, 0.5, 0.5)} fill={ink} />
      ))}
      <path d={limb(add(at, mul(up, 9)), add(add(at, mul(up, 13)), mul(p, 9)), 4, 3.4, 0, 0)} fill={ink} />
      {fingers.map((c, i) => (
        <path
          key={`l${i}`}
          d={`M ${c.x - p.x * 13} ${c.y - p.y * 13} L ${c.x + p.x * 11} ${c.y + p.y * 11}`}
          stroke={detail}
          strokeWidth={0.8}
          opacity={0.6}
        />
      ))}
      <circle cx={sub(at, mul(p, 14)).x} cy={sub(at, mul(p, 14)).y} r={9} fill={ink} />
    </g>
  );
};
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
  const pack = blob([
    S(26, -22),
    S(24, -62),
    S(38, -80),
    S(100, -82),
    S(116, -66),
    S(120, -36),
    S(116, -20),
    S(70, -18),
  ]);
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
    <>
      {/* garante que a arte esteja carregada antes do frame */}
      <Img src={staticFile("Arte.jpg")} style={{ display: "none" }} />
      <svg
        viewBox="-210 -440 420 460"
        height={height}
        width={(height * 420) / 460}
        style={{ overflow: "visible", ...style }}
      >
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
          <line
            x1={P.tip.x}
            y1={P.tip.y}
            x2={P.staffTop.x}
            y2={P.staffTop.y}
            stroke="#2a1b12"
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* lado de trás */}
          <path d={limb(P.shoulderFar, P.armFar.joint, 13, 10, 2, 1)} fill={back} />
          <path d={limb(P.armFar.joint, farHand, 10, 8, 2, 1)} fill={back} />
          <circle cx={farHand.x} cy={farHand.y} r={10} fill={back} />
          <path d={limb(P.hipFar, P.legFar.joint, 20, 14, 2, 4)} fill={back} />
          <path d={limb(P.legFar.joint, P.farFoot.ankle, 14, 10, 4, 0)} fill={back} />
          <Boot f={P.farFoot} ink={back} detail="#2a1f1a" />

          {/* mochila (com inércia) */}
          <g
            transform={`translate(${P.packLag.x} ${P.packLag.y}) rotate(${P.packRot} ${P.shoulder.x} ${P.shoulder.y})`}
          >
            <path d={roll} fill={ink} />
            <path
              d={`M ${S(116, -44).x} ${S(116, -44).y} L ${S(135, -44).x} ${S(135, -44).y} M ${S(116, -70).x} ${S(116, -70).y} L ${S(135, -70).x} ${S(135, -70).y}`}
              stroke={detail}
              strokeWidth={3}
            />
            <path d={pack} fill={ink} />
            <path
              d={`M ${S(92, -24).x} ${S(92, -24).y} Q ${S(96, -52).x} ${S(96, -52).y} ${S(110, -76).x} ${S(110, -76).y}`}
              stroke={detail}
              strokeWidth={3}
              fill="none"
            />
            <path d={blob([S(44, -76), S(44, -94), S(80, -95), S(84, -78)])} fill={ink} />
            <path
              d={`M ${S(44, -80).x} ${S(44, -80).y} L ${S(84, -80).x} ${S(84, -80).y}`}
              stroke={detail}
              strokeWidth={2.5}
            />
          </g>

          {/* tronco */}
          <path d={torso} fill={ink} />
          <path d={strap} stroke={detail} strokeWidth={7} fill="none" strokeLinecap="round" />
          <path
            d={`M ${S(10, -24).x} ${S(10, -24).y} L ${S(12, 27).x} ${S(12, 27).y}`}
            stroke={detail}
            strokeWidth={5}
          />
          <path
            d={`M ${S(118, 18).x} ${S(118, 18).y} L ${S(22, 26).x} ${S(22, 26).y}`}
            stroke={detail}
            strokeWidth={2}
            strokeDasharray="2 5"
          />
          <path d={scarf} fill={ink} />

          {/* cabeça */}
          <path d={blob([P.neckBase, add(P.neckBase, v(8, -4)), H(-16, 8), H(-12, -16)])} fill={ink} />
          <path d={head} fill={ink} />
          <g transform={`rotate(${P.hatLag} ${P.headC.x} ${P.headC.y})`}>
            <path d={crown} fill={ink} />
            <path d={brim} fill={ink} />
            <path
              d={`M ${H(17, -24).x} ${H(17, -24).y} L ${H(17, 24).x} ${H(17, 24).y}`}
              stroke={detail}
              strokeWidth={4}
            />
          </g>
          <path
            d={`M ${H(4, -4).x} ${H(4, -4).y} Q ${H(-2, -8).x} ${H(-2, -8).y} ${H(-6, -2).x} ${H(-6, -2).y}`}
            stroke={detail}
            strokeWidth={2}
            fill="none"
          />

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

          {/* garrafa pendurada no cinto */}
          {!P.held && (
            <>
              <line
                x1={P.beltAnchor.x}
                y1={P.beltAnchor.y}
                x2={P.bottleCenter.x}
                y2={P.bottleCenter.y - 48}
                stroke="#b9bec2"
                strokeWidth={3}
              />
              <Bottle c={P.bottleCenter} angle={P.bottleAngle} glow={bottleGlow} />
            </>
          )}

          {/* braço da frente (+ garrafa na mão) */}
          <path d={limb(P.shoulder, P.armNear.joint, 14, 11, 2, 2)} fill={ink} />
          <path d={limb(P.armNear.joint, nearHand, 11, 8, 2, 1)} fill={ink} />
          <path
            d={`M ${P.armNear.joint.x - 6} ${P.armNear.joint.y - 4} q 6 6 12 2`}
            stroke={detail}
            strokeWidth={2}
            fill="none"
          />
          {P.held && <Bottle c={P.bottleCenter} angle={P.bottleAngle} glow={bottleGlow} />}
          <Hand
            at={nearHand}
            from={P.armNear.joint}
            holding={P.held ? P.bottleAngle : null}
            ink={ink}
            detail={detail}
          />
        </g>
      </svg>
    </>
  );
};
