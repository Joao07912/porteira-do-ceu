import { Composition } from "remotion";
import { Promo, PROMO_DURATION } from "./Promo";
import { Narrado } from "./narrado/Narrado";
import { FPS, TOTAL_FRAMES } from "./narrado/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
