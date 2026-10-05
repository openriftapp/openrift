import { createApiClients } from "./api-client.js";
import { createBot } from "./bot.js";
import { CatalogCache } from "./catalog-cache.js";
import { readBotEnv } from "./env.js";
import { log } from "./log.js";
import { RulesCache } from "./rules-cache.js";
import { TradeChannelCache } from "./trade-channels.js";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const STARTUP_RETRY_MS = 15 * 1000;

const env = readBotEnv();
const api = createApiClients(env.apiUrl, env.apiSecret);
const cache = new CatalogCache({
  fetchCatalog: () => api.catalog.catalog({}),
  fetchInit: () => api.init.get(),
  fetchPrices: () => api.prices.prices(),
});
const rules = new RulesCache({
  fetchRules: (kind) => api.rules.list({ kind }),
});

// The API container may still be booting when the bot starts (compose gates on
// its healthcheck, but a fresh deploy can race); retry until both caches load.
while (cache.snapshot === null || rules.snapshot === null) {
  try {
    await Promise.all([
      cache.snapshot === null ? cache.refresh() : undefined,
      rules.snapshot === null ? rules.refresh() : undefined,
    ]);
  } catch (error) {
    log.error({ err: error }, `Startup fetch failed, retrying in ${STARTUP_RETRY_MS / 1000}s`);
    await Bun.sleep(STARTUP_RETRY_MS);
  }
}
log.info(
  `Catalog loaded: ${cache.snapshot.cards.length} cards; rules loaded: ` +
    `${rules.snapshot.core.rules.length} core, ${rules.snapshot.tournament.rules.length} tournament`,
);

async function refreshSafely(): Promise<void> {
  try {
    await cache.refresh();
  } catch (error) {
    log.error({ err: error }, "Catalog refresh failed, keeping previous snapshot");
  }
  try {
    await rules.refresh();
  } catch (error) {
    log.error({ err: error }, "Rules refresh failed, keeping previous snapshot");
  }
}

setInterval(() => void refreshSafely(), REFRESH_INTERVAL_MS);

// Which channels get scanned. Off by default and never blocking: a failure
// here leaves the map empty, which means no scanning, not scanning everything.
const tradeChannels = new TradeChannelCache(api);
await tradeChannels.start();
log.info(`Trade scanning: ${env.tradeScanMode === "reply" ? "replying" : "log-only"}`);

const client = createBot({ env, api, cache, rules, tradeChannels });

async function shutdown(signal: string): Promise<void> {
  log.info(`Received ${signal}, shutting down`);
  try {
    await client.destroy();
  } finally {
    process.exit(0);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown(signal));
}

await client.login(env.token);
