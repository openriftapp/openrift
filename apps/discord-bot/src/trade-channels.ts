import { MINUTE_MS } from "@openrift/shared/format-date";

import type { ApiClients } from "./api-client.js";
import { log } from "./log.js";

const REFRESH_INTERVAL_MS = 30 * MINUTE_MS;

export class TradeChannelCache {
  private channels = new Map<string, Set<string>>();
  // Local write order: a server list fetched before a write-through must not undo it.
  private sequence = 0;
  private readonly setAt = new Map<string, number>();
  private appliedRefreshAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly api: ApiClients;

  constructor(api: ApiClients) {
    this.api = api;
  }

  // Unknown guilds and channels default to false: a failed refresh must not scan everything.
  isTradeChannel(guildId: string | null | undefined, channelId: string): boolean {
    return guildId ? (this.channels.get(guildId)?.has(channelId) ?? false) : false;
  }

  set(guildId: string, channelIds: string[]): void {
    this.setAt.set(guildId, ++this.sequence);
    if (channelIds.length === 0) {
      this.channels.delete(guildId);
      return;
    }
    this.channels.set(guildId, new Set(channelIds));
  }

  // A failed refresh keeps the previous map; it does not clear it.
  async refresh(): Promise<boolean> {
    if (!this.api.discordBot) {
      return false;
    }
    const startedAt = ++this.sequence;
    try {
      const response = await this.api.discordBot.tradeChannels({});
      if (startedAt < this.appliedRefreshAt) {
        return true;
      }
      this.appliedRefreshAt = startedAt;
      const next = new Map(
        response.guilds.map((guild) => [guild.guildId, new Set(guild.channelIds)]),
      );
      for (const [guildId, writtenAt] of this.setAt) {
        if (writtenAt < startedAt) {
          this.setAt.delete(guildId);
          continue;
        }
        const local = this.channels.get(guildId);
        if (local) {
          next.set(guildId, local);
        } else {
          next.delete(guildId);
        }
      }
      this.channels = next;
      return true;
    } catch (error) {
      log.error({ err: error }, "trade-channel refresh failed");
      return false;
    }
  }

  /** Loads the map once and keeps it fresh. Safe to call when the feature is off. */
  async start(): Promise<void> {
    if (!this.api.discordBot) {
      return;
    }
    await this.refresh();
    this.timer ??= setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
