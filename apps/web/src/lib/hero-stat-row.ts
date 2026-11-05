import { cn } from "@/lib/utils";

export function heroStatRowClass(count: number): string {
  return cn(
    "grid gap-x-9 gap-y-3 sm:flex sm:flex-wrap",
    count >= 4 ? "grid-cols-2" : "grid-cols-3",
  );
}
