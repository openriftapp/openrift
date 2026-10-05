import type { StageGround } from "@openrift/shared/contracts/stage-presets";

export function isChromaGround(ground: StageGround): boolean {
  return ground !== "black";
}
