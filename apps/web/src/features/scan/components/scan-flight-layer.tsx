import { useEffect, useEffectEvent, useRef } from "react";
import type { RefObject } from "react";

import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { planFlight } from "@/features/scan/lib/scan-flight";
import type { FlightRect } from "@/features/scan/lib/scan-flight";
import { prefersReducedMotion } from "@/lib/media-query";

/** One card in flight from the camera guide to the session tray. */
export interface ScanFlight {
  id: string;
  image: string;
  source: FlightRect;
}

const MAX_CONCURRENT_FLIGHTS = 4;
const FLIGHT_EASING = "cubic-bezier(0.34, 1.24, 0.64, 1)";
const FADE_START = 0.6;
const FINISH_GRACE_MS = 400;

function fallbackTargetRect(source: FlightRect): FlightRect {
  const width = source.width * 0.35;
  const height = source.height * 0.35;
  const viewportWidth = globalThis.innerWidth ?? 0;
  const viewportHeight = globalThis.innerHeight ?? 0;
  return {
    x: (viewportWidth - width) / 2,
    y: viewportHeight - height * 1.5,
    width,
    height,
  };
}

function FlightCard({
  flight,
  targetRef,
  onEnd,
}: {
  flight: ScanFlight;
  targetRef: RefObject<HTMLElement | null>;
  onEnd: (id: string) => void;
}) {
  const nodeRef = useRef<HTMLImageElement>(null);
  const { id, source } = flight;

  const readStart = useEffectEvent(() => source);
  const readTarget = useEffectEvent(() => targetRef.current?.getBoundingClientRect());
  const end = useEffectEvent((flightId: string) => onEnd(flightId));

  useEffect(() => {
    const node = nodeRef.current;
    const start = readStart();
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      end(id);
    };

    // Reduced motion, or a browser without the Web Animations API: never show the card.
    if (node === null || prefersReducedMotion() || typeof node.animate !== "function") {
      finish();
      return;
    }

    const target = readTarget();
    const plan = planFlight(
      start,
      target === undefined
        ? fallbackTargetRect(start)
        : { x: target.x, y: target.y, width: target.width, height: target.height },
    );
    const options: KeyframeAnimationOptions = { duration: plan.durationMs, fill: "forwards" };

    // Keep transform and opacity as separate animations: merging them would
    // apply the fade's linear easing to the overshoot translate too.
    const move = node.animate(
      [
        {
          transform: `translate3d(${plan.from.translateX}px, ${plan.from.translateY}px, 0) scale(${plan.from.scale})`,
        },
        {
          transform: `translate3d(${plan.to.translateX}px, ${plan.to.translateY}px, 0) scale(${plan.to.scale})`,
        },
      ],
      { ...options, easing: FLIGHT_EASING },
    );
    const fade = node.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: FADE_START },
        { opacity: 0, offset: 1 },
      ],
      { ...options, easing: "linear" },
    );

    move.addEventListener("finish", finish);
    // A backgrounded tab can swallow the finish event; this timer is the backstop.
    const timer = globalThis.setTimeout(finish, plan.durationMs + FINISH_GRACE_MS);

    return () => {
      globalThis.clearTimeout(timer);
      move.removeEventListener("finish", finish);
      move.cancel();
      fade.cancel();
    };
  }, [id]);

  return (
    <ImgWithFallback
      fallback={null}
      ref={nodeRef}
      src={flight.image}
      alt=""
      className="rounded-card fixed opacity-0 shadow-lg ring-1 ring-white/25 will-change-transform"
      style={{
        left: `${source.x}px`,
        top: `${source.y}px`,
        width: `${source.width}px`,
        height: `${source.height}px`,
        transformOrigin: "center",
      }}
    />
  );
}

export function ScanFlightLayer({
  flights,
  targetRef,
  onFlightEnd,
  maxConcurrent = MAX_CONCURRENT_FLIGHTS,
}: {
  flights: readonly ScanFlight[];
  targetRef: RefObject<HTMLElement | null>;
  onFlightEnd: (id: string) => void;
  maxConcurrent?: number;
}) {
  const limit = Math.max(1, maxConcurrent);
  const visible = flights.slice(-limit);
  // Compared by value, not identity: the caller may hand a fresh array on every render.
  const droppedKey = flights
    .slice(0, Math.max(0, flights.length - limit))
    .map((flight) => flight.id)
    .join("\n");

  const endFlight = useEffectEvent((id: string) => onFlightEnd(id));

  useEffect(() => {
    if (droppedKey === "") {
      return;
    }
    for (const id of droppedKey.split("\n")) {
      endFlight(id);
    }
  }, [droppedKey]);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-60">
      {visible.map((flight) => (
        <FlightCard key={flight.id} flight={flight} targetRef={targetRef} onEnd={onFlightEnd} />
      ))}
    </div>
  );
}
