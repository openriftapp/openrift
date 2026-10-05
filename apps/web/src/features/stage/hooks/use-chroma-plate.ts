import { isChromaGround } from "@/features/stage/lib/chroma-ground";
import { usePresentationStore } from "@/features/stage/stores/presentation-store";

/** A chroma filter keys any partly-opaque pixel partly out, fringing translucent panels; an opaque plate gives content something to composite against instead. */
export function useChromaPlate(): string {
  const ground = usePresentationStore((state) => state.ground);
  return isChromaGround(ground) ? "rounded-lg bg-[#08090c] p-3" : "";
}
