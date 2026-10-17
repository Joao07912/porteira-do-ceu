import { Composition } from "remotion";
import { Promo, PROMO_DURATION } from "./Promo";
import { Narrado } from "./narrado/Narrado";
import { FPS, TOTAL_FRAMES } from "./narrado/timeline";
import { V3 } from "./v3/V3";
import { TOTAL_FRAMES as V3_FRAMES } from "./v3/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Garrafa3D"
        component={V3}
        defaultProps={{ narration: true }}
        durationInFrames={V3_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Garrafa3DMusica"
        component={V3}
        defaultProps={{ narration: false }}
        durationInFrames={V3_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Garrafa2D"
        component={V3}
        defaultProps={{ narration: true, pilgrim: "2d" as const }}
        durationInFrames={V3_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Garrafa2DMusica"
        component={V3}
        defaultProps={{ narration: false, pilgrim: "2d" as const }}
        durationInFrames={V3_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Narrado"
        component={Narrado}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition id="Promo" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={1080} height={1920} />
    </>
  );
};
