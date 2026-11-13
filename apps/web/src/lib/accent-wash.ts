export function accentGlow(strength: number): string {
  return `radial-gradient(120% 90% at 50% 115%, color-mix(in oklab, var(--border-accent) ${strength}%, transparent), transparent 70%)`;
}

export const FINAL_GLOW = accentGlow(12);

export const HERO_WASH = [
  "radial-gradient(90% 130% at 85% 10%, color-mix(in oklab, var(--border-accent) 26%, transparent), transparent 62%)",
  "radial-gradient(70% 120% at 65% 100%, color-mix(in oklab, var(--violet) 14%, transparent), transparent 65%)",
  "linear-gradient(color-mix(in oklab, var(--muted) 50%, var(--background)), var(--background))",
].join(", ");

export const TILE_WASH = [
  "radial-gradient(90% 130% at 85% 10%, color-mix(in oklab, var(--border-accent) 26%, transparent), transparent 62%)",
  "radial-gradient(70% 120% at 20% 100%, color-mix(in oklab, var(--violet) 16%, transparent), transparent 65%)",
  "linear-gradient(color-mix(in oklab, var(--muted) 55%, var(--card)), var(--card))",
].join(", ");
