import { useRive } from "@rive-app/react-canvas";

/**
 * Slot Rive per le celebrazioni — runtime @rive-app/react-canvas.
 *
 * Le animazioni Rive sono asset .riv autorati nell'editor (rive.app) con
 * state machine. Quando una voce del registry specifica `riv`, questo layer
 * viene montato dietro/insieme alla scena GSAP e parte in autoplay.
 *
 * Per attivarlo su un achievement:
 *   1. esporta il .riv dall'editor Rive in `public/rive/<nome>.riv`
 *   2. nel registry: riv: { src: "/rive/<nome>.riv", stateMachine: "State Machine 1" }
 * Il file viene precaricato dal runtime; gli input/trigger della state machine
 * si possono pilotare con useStateMachineInput se servirà interattività.
 */
export function RiveLayer({
  src,
  stateMachine,
  className,
}: {
  src: string;
  stateMachine?: string;
  className?: string;
}) {
  const { RiveComponent } = useRive({
    src,
    stateMachines: stateMachine,
    autoplay: true,
  });
  return <RiveComponent className={className} />;
}
