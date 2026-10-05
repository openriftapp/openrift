import { useMeasuredDimension } from "@/hooks/use-measured-dimension";

export function useMeasuredWidth(el: HTMLElement | null): number {
  return useMeasuredDimension(el, "width");
}
