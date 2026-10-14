// Peregrino em silhueta (olhando para a direita), com chapéu, mochila, cajado e a garrafa.
// viewBox 200x400; os pés tocam o chão em y≈392.

const INK = "#1b110b";

export const Pilgrim: React.FC<{
  phase: number; // ciclo da caminhada em radianos (0 = parado)
  walking?: boolean;
  bottleGlow?: number; // 0..1, destaca a garrafa
  height: number;
  style?: React.CSSProperties;
}> = ({ phase, walking = true, bottleGlow = 0, height, style }) => {
  const swing = walking ? 1 : 0;
  const a = 24 * Math.sin(phase) * swing;
  const bob = walking ? -Math.abs(Math.cos(phase)) * 5 : 0;
  const knee = (s: number) => (walking ? Math.max(0, -Math.sin(phase * s + 0.6)) * 34 : 0);

  const Leg: React.FC<{ angle: number; bend: number; shade?: string }> = ({ angle, bend, shade = INK }) => (
    <g transform={`rotate(${angle} 102 212)`} fill={shade}>
      <rect x={92} y={204} width={22} height={96} rx={10} />
      <g transform={`rotate(${bend} 103 296)`}>
        <rect x={94} y={290} width={19} height={96} rx={9} />
        <path d="M 92 380 Q 92 392 104 394 L 128 394 Q 132 386 120 380 Z" />
      </g>
    </g>
  );

  return (
    <svg
      viewBox="0 0 200 400"
      height={height}
      width={height / 2}
      style={{ overflow: "visible", filter: "drop-shadow(0 0 3px rgba(255,190,120,0.55))", ...style }}
    >
      <g transform={`translate(0 ${bob})`}>
        {/* perna e braço de trás */}
        <Leg angle={-a} bend={knee(-1)} shade="#120b07" />
        <g transform={`rotate(${a * 0.9} 104 102)`} fill="#120b07">
          <rect x={96} y={96} width={16} height={92} rx={8} />
        </g>

        {/* mochila com colchonete */}
        <rect x={46} y={90} width={46} height={112} rx={16} fill={INK} />
        <rect x={44} y={78} width={50} height={20} rx={10} fill={INK} />

        {/* garrafa presa na mochila */}
        <g transform="rotate(-6 46 178)">
          <rect x={36} y={146} width={8} height={10} rx={2} fill="#111" />
          <rect x={30} y={154} width={20} height={50} rx={7} fill="#efe9dc" />
          <rect x={30} y={166} width={20} height={26} fill="#e08a3c" />
          <rect x={30} y={180} width={20} height={6} fill="#2a4a86" />
          {bottleGlow > 0 && (
            <rect
              x={24}
              y={142}
              width={32}
              height={68}
              rx={12}
              fill="none"
              stroke="#ffe7b0"
              strokeWidth={3}
              opacity={bottleGlow}
            />
          )}
        </g>

        {/* corpo */}
        <path d="M 84 92 Q 104 84 126 94 L 128 150 Q 126 196 122 214 L 84 214 Q 80 160 84 92 Z" fill={INK} />
        {/* cabeça e chapéu */}
        <rect x={98} y={74} width={14} height={18} fill={INK} />
        <circle cx={108} cy={64} r={19} fill={INK} />
        <path d="M 120 66 L 130 70 L 122 74 Z" fill={INK} />
        <ellipse cx={106} cy={50} rx={42} ry={7} fill={INK} />
        <path d="M 84 50 Q 84 24 106 22 Q 128 24 128 50 Z" fill={INK} />

        {/* perna da frente */}
        <Leg angle={a} bend={knee(1)} />

        {/* braço da frente segurando o cajado */}
        <g transform={`rotate(${-a * 0.5 - 20} 108 102)`}>
          <rect x={100} y={96} width={16} height={60} rx={8} fill={INK} />
          <g transform="rotate(-40 108 150)">
            <rect x={101} y={146} width={15} height={56} rx={7} fill={INK} />
            <circle cx={109} cy={204} r={9} fill={INK} />
          </g>
        </g>
      </g>
      {/* cajado (fica no chão, acompanha a mão) */}
      <line
        x1={150 + a * 0.6}
        y1={110 + bob}
        x2={168 + a * 0.2}
        y2={394}
        stroke="#2a1a10"
        strokeWidth={7}
        strokeLinecap="round"
      />
    </svg>
  );
};
