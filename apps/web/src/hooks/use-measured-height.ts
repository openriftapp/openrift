import { useMeasuredDimension } from "@/hooks/use-measured-dimension";

export function useMeasuredHeight(el: HTMLElement | null): number {
  return useMeasuredDimension(el, "height");
}
