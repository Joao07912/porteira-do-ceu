import { Img, staticFile } from "remotion";

const ART_RATIO = 689 / 1600;

// Garrafa de alumínio desenhada em CSS, com a Arte.jpg envolvendo o corpo.
// `turn` = quanto a garrafa já girou (0..1 = uma volta inteira).
export const Bottle: React.FC<{ width: number; turn: number; shine?: number; style?: React.CSSProperties }> = ({
  width: W,
  turn,
  shine = 0,
  style,
}) => {
  const labelW = Math.PI * W; // a arte cobre a circunferência inteira
  const labelH = labelW * ART_RATIO;
  const bodyH = labelH + W * 0.55;
  const metal = "linear-gradient(90deg, #a9a49b 0%, #e9e5dc 14%, #ffffff 30%, #f3efe7 52%, #d6d1c7 78%, #8f8a81 100%)";
  const cylinderShade =
    "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.05) 18%, rgba(255,255,255,0.35) 29%, rgba(255,255,255,0) 40%, rgba(0,0,0,0) 64%, rgba(0,0,0,0.55) 100%)";

  return (
    <div
      style={{
        position: "relative",
        width: W,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        ...style,
      }}
    >
      {/* garante que o Remotion espere a arte carregar */}
      <Img src={staticFile("Arte.jpg")} style={{ display: "none" }} />

      {/* bico */}
      <div
        style={{
          width: W * 0.24,
          height: W * 0.2,
          borderRadius: `${W * 0.06}px ${W * 0.06}px 0 0`,
          background: "linear-gradient(90deg,#111,#3a3a3a 35%,#141414 70%,#000)",
        }}
      />
      {/* tampa com ranhuras */}
      <div
        style={{
          width: W * 0.62,
          height: W * 0.28,
          borderRadius: W * 0.05,
          background:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 6px, rgba(0,0,0,0.25) 6px 12px), linear-gradient(90deg,#0d0d0d,#3b3b3b 30%,#151515 65%,#000)",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* mosquetão */}
        <svg
          viewBox="0 0 60 110"
          width={W * 0.34}
          style={{ position: "absolute", left: -W * 0.24, top: W * 0.06, overflow: "visible" }}
        >
          <rect x={8} y={6} width={40} height={96} rx={20} fill="none" stroke="#cfd3d6" strokeWidth={7} />
          <rect
            x={8}
            y={6}
            width={40}
            height={96}
            rx={20}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.5}
            strokeWidth={2}
          />
          <line x1={48} y1={30} x2={48} y2={78} stroke="#8a8f93" strokeWidth={8} />
        </svg>
      </div>
      {/* ombro */}
      <div
        style={{
          marginTop: -W * 0.04,
          width: W,
          height: W * 0.42,
          borderRadius: `${W * 0.5}px ${W * 0.5}px 0 0 / ${W * 0.42}px ${W * 0.42}px 0 0`,
          background: metal,
        }}
      />
      {/* corpo */}
      <div
        style={{
          width: W,
          height: bodyH,
          borderRadius: `0 0 ${W * 0.12}px ${W * 0.12}px`,
          background: metal,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 40px 80px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: W * 0.12,
            left: 0,
            width: W,
            height: labelH,
            backgroundImage: `url(${staticFile("Arte.jpg")})`,
            backgroundSize: `${labelW}px ${labelH}px`,
            backgroundRepeat: "repeat-x",
            backgroundPositionX: -turn * labelW,
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: cylinderShade }} />
        {shine > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: W * 0.35,
              left: -W * 0.5 + shine * W * 2,
              background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))",
              transform: "skewX(-12deg)",
            }}
          />
        )}
      </div>
    </div>
  );
};
