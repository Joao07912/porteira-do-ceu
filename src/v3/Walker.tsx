import { interpolate } from "remotion";

// Peregrino em silhueta com esqueleto e ciclo de caminhada por keyframes.
// Olha para a direita. Origem do viewBox = chão, embaixo do quadril.

type P = { x: number; y: number };
const rad = (d: number) => (d * Math.PI) / 180;
// ângulo medido a partir da vertical para baixo; positivo = para frente (direita)
const step = (p: P, len: number, deg: number): P => ({ x: p.x + len * Math.sin(rad(deg)), y: p.y + len * Math.cos(rad(deg)) });
const rot = (p: P, o: P, deg: number): P => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return { x: o.x + (p.x - o.x) * c - (p.y - o.y) * s, y: o.y + (p.x - o.x) * s + (p.y - o.y) * c };
};
const key = (t: number, ts: number[], vs: number[]) =>
  interpolate(t, ts, vs, { easing: (x) => 0.5 - Math.cos(x * Math.PI) / 2 });

const THIGH = 100;
const SHIN = 96;
const ANKLE = 12;

const legPose = (t: number) => {
  const u = ((t % 1) + 1) % 1;
  return {
    thigh: key(u, [0, 0.25, 0.5, 0.62, 0.78, 0.92, 1], [24, 6, -19, -13, 10, 26, 24]),
    knee: key(u, [0, 0.1, 0.28, 0.42, 0.52, 0.64, 0.78, 0.92, 1], [3, 15, 5, 10, 36, 62, 38, 6, 3]),
    foot: key(u, [0, 0.08, 0.4, 0.5, 0.6, 0.86, 1], [16, 0, 0, -32, -16, 8, 16]), // + = ponta pra cima
  };
};

const solveLeg = (hip: P, t: number) => {
  const { thigh, knee, foot } = legPose(t);
  const k = step(hip, THIGH, thigh);
  const a = step(k, SHIN, thigh - knee);
  const ground = { x: a.x, y: a.y + ANKLE };
  const heel = rot({ x: ground.x - 14, y: ground.y }, a, -foot);
  const toe = rot({ x: ground.x + 34, y: ground.y }, a, -foot);
  return { hip, k, a, heel, toe, low: Math.max(heel.y, toe.y) };
};

const Limb: React.FC<{ a: P; b: P; r1: number; r2: number; fill: string }> = ({ a, b, r1, r2, fill }) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const d = `M ${a.x + nx * r1} ${a.y + ny * r1} L ${b.x + nx * r2} ${b.y + ny * r2} L ${b.x - nx * r2} ${b.y - ny * r2} L ${a.x - nx * r1} ${a.y - ny * r1} Z`;
  return (
    <g fill={fill}>
      <path d={d} />
      <circle cx={a.x} cy={a.y} r={r1} />
      <circle cx={b.x} cy={b.y} r={r2} />
    </g>
  );
};

const Boot: React.FC<{ leg: ReturnType<typeof solveLeg>; fill: string }> = ({ leg, fill }) => {
  const { a, heel, toe } = leg;
  const up = { x: (heel.x + toe.x) / 2 - a.x, y: (heel.y + toe.y) / 2 - a.y };
  const L = Math.hypot(up.x, up.y) || 1;
  const n = { x: -up.x / L, y: -up.y / L }; // aponta do chão para o tornozelo
  const top = (p: P, h: number) => ({ x: p.x + n.x * h, y: p.y + n.y * h });
  const toeTop = top(toe, 12);
  const heelTop = top(heel, 20);
  return (
    <path
      d={`M ${heelTop.x} ${heelTop.y} L ${a.x - 4} ${a.y - 10} L ${a.x + 9} ${a.y - 8} Q ${toeTop.x - 6} ${toeTop.y - 4} ${toeTop.x} ${toeTop.y} Q ${toe.x + 6} ${toe.y - 2} ${toe.x} ${toe.y} L ${heel.x} ${heel.y} Z`}
      fill={fill}
    />
  );
};

export const Walker: React.FC<{
  t: number; // ciclo da caminhada (1 = dois passos)
  frame: number; // para o lenço balançar
  height: number;
  bottleGlow?: number;
  ink?: string;
  rim?: string;
  style?: React.CSSProperties;
}> = ({ t, frame, height, bottleGlow = 0, ink = "#1a1310", rim = "rgba(255,170,90,0.75)", style }) => {
  const back = "#0f0b09";
  const detail = "#2c2019";
  const legsAt = (hipY: number) => [solveLeg({ x: 0, y: hipY }, t + 0.5), solveLeg({ x: 0, y: hipY }, t)];
  // assenta o pé mais baixo no chão (y = 0) → o quadril sobe e desce sozinho
  const probe = legsAt(0);
  const hipY = -Math.max(probe[0].low, probe[1].low);
  const [farLeg, nearLeg] = legsAt(hipY);
  const hip = { x: 0, y: hipY };

  const lean = 9 + Math.sin(t * Math.PI * 4) * 1.2;
  const neck = step(hip, -150, -lean); // comprimento negativo = para cima
  const shoulder = step(hip, -132, -lean);
  const headC = step(neck, -26, -lean - 4);

  // braços: oposto à perna do mesmo lado
  const armSwing = (ph: number) => -20 * Math.cos(2 * Math.PI * ph);
  const farUpper = armSwing(t + 0.5);
  const farElbow = step(shoulder, 72, farUpper);
  const farHand = step(farElbow, 66, farUpper + 18 + Math.max(0, farUpper) * 0.9);
  const nearUpper = 10 + armSwing(t) * 0.45;
  const nearElbow = step(shoulder, 72, nearUpper);
  const nearHand = step(nearElbow, 60, nearUpper + 62);

  // cajado: a ponta fica à frente, no chão; passa pela mão
  const tip = { x: nearHand.x + 34 + 14 * Math.sin(2 * Math.PI * t), y: 0 };
  const dir = { x: nearHand.x - tip.x, y: nearHand.y - tip.y };
  const dl = Math.hypot(dir.x, dir.y);
  const staffTop = { x: nearHand.x + (dir.x / dl) * 46, y: nearHand.y + (dir.y / dl) * 46 };

  // mochila presa ao tronco
  const packO = step(hip, -80, -lean);
  const pack = (x: number, y: number) => rot({ x: packO.x + x, y: packO.y + y }, packO, lean);
  const p1 = pack(-78, -66);
  const flutter = Math.sin(frame / 4.5) * 6;

  const torso = [
    step(hip, -4, -lean),
    rot({ x: hip.x + 22, y: hip.y - 6 }, hip, lean),
    rot({ x: hip.x + 30, y: hip.y - 80 }, hip, lean),
    rot({ x: hip.x + 22, y: hip.y - 140 }, hip, lean),
    rot({ x: hip.x - 4, y: hip.y - 156 }, hip, lean),
    rot({ x: hip.x - 26, y: hip.y - 138 }, hip, lean),
    rot({ x: hip.x - 24, y: hip.y - 10 }, hip, lean),
  ];
  const poly = (ps: P[]) => ps.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  const bottleO = pack(-88, 4);

  return (
    <svg
      viewBox="-170 -470 340 490"
      height={height}
      width={(height * 340) / 490}
      style={{ overflow: "visible", filter: `drop-shadow(0 0 4px ${rim})`, ...style }}
    >
      <ellipse cx={8} cy={4} rx={86} ry={7} fill="rgba(0,0,0,0.25)" />

      {/* lado de trás */}
      <Limb a={shoulder} b={farElbow} r1={14} r2={11} fill={back} />
      <Limb a={farElbow} b={farHand} r1={11} r2={9} fill={back} />
      <circle cx={farHand.x} cy={farHand.y} r={11} fill={back} />
      <Limb a={farLeg.hip} b={farLeg.k} r1={20} r2={14} fill={back} />
      <Limb a={farLeg.k} b={farLeg.a} r1={14} r2={10} fill={back} />
      <Boot leg={farLeg} fill={back} />

      {/* mochila + colchonete */}
      <g transform={`rotate(${lean} ${packO.x} ${packO.y})`}>
        <rect x={packO.x - 82} y={packO.y - 62} width={66} height={140} rx={22} fill={ink} />
        <rect x={packO.x - 90} y={packO.y - 20} width={18} height={70} rx={8} fill={ink} />
        <path
          d={`M ${packO.x - 74} ${packO.y - 30} h 50 M ${packO.x - 74} ${packO.y + 40} h 50`}
          stroke={detail}
          strokeWidth={3}
        />
        <rect x={packO.x - 86} y={packO.y - 84} width={78} height={28} rx={14} fill={ink} />
        <path d={`M ${packO.x - 66} ${packO.y - 84} v 28 M ${packO.x - 26} ${packO.y - 84} v 28`} stroke={detail} strokeWidth={3} />
      </g>

      {/* garrafa no mosquetão */}
      <g transform={`rotate(${lean - 4} ${bottleO.x} ${bottleO.y})`}>
        <circle cx={bottleO.x + 6} cy={bottleO.y - 40} r={7} fill="none" stroke="#9aa0a4" strokeWidth={3} />
        <rect x={bottleO.x - 4} y={bottleO.y - 36} width={14} height={9} rx={2} fill="#111" />
        <rect x={bottleO.x - 9} y={bottleO.y - 28} width={24} height={64} rx={8} fill="#eee8dc" />
        <rect x={bottleO.x - 9} y={bottleO.y - 14} width={24} height={34} fill="#e2853f" />
        <rect x={bottleO.x - 9} y={bottleO.y + 4} width={24} height={7} fill="#2a4a86" />
        <rect x={bottleO.x - 9} y={bottleO.y - 28} width={6} height={64} rx={3} fill="rgba(255,255,255,0.45)" />
        {bottleGlow > 0 && (
          <rect
            x={bottleO.x - 18}
            y={bottleO.y - 50}
            width={42}
            height={96}
            rx={16}
            fill="none"
            stroke="#ffe3a6"
            strokeWidth={4}
            opacity={bottleGlow}
          />
        )}
      </g>

      {/* tronco */}
      <path d={poly(torso)} fill={ink} />
      <path d={`M ${p1.x + 70} ${p1.y + 10} Q ${shoulder.x + 20} ${shoulder.y + 30} ${hip.x + 18} ${hip.y - 40}`} stroke={detail} strokeWidth={5} fill="none" />
      {/* lenço */}
      <path
        d={`M ${neck.x - 8} ${neck.y + 8} Q ${neck.x - 40} ${neck.y + 4 + flutter} ${neck.x - 62} ${neck.y + 18 + flutter * 1.6} L ${neck.x - 30} ${neck.y + 22} Z`}
        fill={ink}
      />

      {/* cabeça de perfil, barba e chapéu */}
      <g transform={`rotate(${lean * 0.6} ${headC.x} ${headC.y})`}>
        <rect x={neck.x - 9} y={neck.y - 16} width={20} height={22} fill={ink} />
        <path
          d={`M ${headC.x - 18} ${headC.y - 6} Q ${headC.x - 20} ${headC.y - 26} ${headC.x} ${headC.y - 26} Q ${headC.x + 20} ${headC.y - 24} ${headC.x + 21} ${headC.y - 4} L ${headC.x + 29} ${headC.y + 4} L ${headC.x + 21} ${headC.y + 8} Q ${headC.x + 22} ${headC.y + 26} ${headC.x + 4} ${headC.y + 30} Q ${headC.x - 14} ${headC.y + 28} ${headC.x - 18} ${headC.y + 12} Z`}
          fill={ink}
        />
        <ellipse cx={headC.x + 2} cy={headC.y - 18} rx={54} ry={8} fill={ink} />
        <path d={`M ${headC.x - 22} ${headC.y - 18} Q ${headC.x - 22} ${headC.y - 50} ${headC.x + 2} ${headC.y - 52} Q ${headC.x + 26} ${headC.y - 50} ${headC.x + 24} ${headC.y - 18} Z`} fill={ink} />
        <rect x={headC.x - 22} y={headC.y - 28} width={46} height={6} fill={detail} />
      </g>

      {/* lado da frente */}
      <Limb a={nearLeg.hip} b={nearLeg.k} r1={21} r2={15} fill={ink} />
      <Limb a={nearLeg.k} b={nearLeg.a} r1={15} r2={11} fill={ink} />
      <Boot leg={nearLeg} fill={ink} />
      <line x1={tip.x} y1={tip.y} x2={staffTop.x} y2={staffTop.y} stroke="#24170f" strokeWidth={8} strokeLinecap="round" />
      <Limb a={shoulder} b={nearElbow} r1={15} r2={12} fill={ink} />
      <Limb a={nearElbow} b={nearHand} r1={12} r2={10} fill={ink} />
      <circle cx={nearHand.x} cy={nearHand.y} r={12} fill={ink} />
    </svg>
  );
};
