export const DISCORD_EMBED_COLOR = 0x24_70_5f;

export function discordEmbedColorHex(): string {
  return `#${DISCORD_EMBED_COLOR.toString(16).padStart(6, "0")}`;
}
