import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, Easing } from "remotion";

type CircleProps = { x?: number; y?: number };

// a cena nova aparece de dentro de um círculo que cresce (como na referência)
const CirclePresentation: React.FC<TransitionPresentationComponentProps<CircleProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const p = Easing.bezier(0.65, 0, 0.35, 1)(presentationProgress);
  const x = passedProps.x ?? 50;
  const y = passedProps.y ?? 50;
  return <AbsoluteFill style={{ clipPath: `circle(${p * 150}% at ${x}% ${y}%)` }}>{children}</AbsoluteFill>;
};

export const circle = (props: CircleProps = {}): TransitionPresentation<CircleProps> => ({
  component: CirclePresentation,
  props,
});
