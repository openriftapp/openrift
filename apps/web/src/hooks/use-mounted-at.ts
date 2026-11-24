import { useConstant } from "@/lib/use-constant";

export function useMountedAt(): Date {
  return useConstant(() => new Date());
}
