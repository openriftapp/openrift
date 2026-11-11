import { enumLabel } from "@openrift/shared/enum-label";
import { imageUrl } from "@openrift/shared/image-url";
import type { Logger } from "@openrift/shared/logger";
import { formatPrintingVariantLabelParts } from "@openrift/shared/printing-label";
import { WellKnown } from "@openrift/shared/well-known";

import { DEFAULT_TIMEOUT_MS } from "../../../lib/http.js";
import type { EnrichedPrintingEvent } from "../../catalog/repositories/printing-events.js";

// Discord allows up to 10 embeds per message.
const MAX_EMBEDS_PER_MESSAGE = 10;
const SUMMARY_THRESHOLD = 20;
// Discord caps an embed description at 4096 characters.
const MAX_DESCRIPTION_LENGTH = 4000;
const MESSAGE_INTERVAL_MS = 1000;
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_AFTER_MS = 60_000;
const DEFAULT_RETRY_AFTER_MS = 1000;

const COLOR_NEW = 0x57_f2_87;

interface DiscordEmbed {
  title: string;
  url?: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnail?: { url: string };
  image?: { url: string };
  author?: { name: string; url?: string };
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

export interface NewPrintingMessage {
  body: DiscordWebhookPayload;
  eventIds: string[];
}

export interface WebhookFailure {
  channel: "newPrintings";
  status?: number;
  detail: string;
}

// Discord requires absolute URLs for embed images.
function absoluteImageUrl(appBaseUrl: string, id: string | null): string | undefined {
  if (!id) {
    return undefined;
  }
  return `${appBaseUrl}${imageUrl(id, "400w")}`;
}

interface FlushOptions {
  webhookUrl: string | null;
  appBaseUrl: string;
  labels: PrintingLabels;
  log: Logger;
  onSent: (eventIds: string[]) => Promise<void>;
  sleep?: (ms: number) => Promise<unknown>;
}

export async function flushPrintingEvents(
  events: EnrichedPrintingEvent[],
  { webhookUrl, appBaseUrl, labels, log, onSent, sleep = (ms) => Bun.sleep(ms) }: FlushOptions,
): Promise<{ sentIds: string[]; failedIds: string[]; failures: WebhookFailure[] }> {
  const sentIds: string[] = [];
  const failedIds: string[] = [];
  const failures: WebhookFailure[] = [];

  if (events.length === 0) {
    return { sentIds, failedIds, failures };
  }

  if (!webhookUrl) {
    const ids = events.map((event) => event.id);
    await onSent(ids);
    return { sentIds: ids, failedIds, failures };
  }

  const messages = buildNewPrintingMessages(events, appBaseUrl, labels);
  for (const [index, message] of messages.entries()) {
    if (index > 0) {
      await sleep(MESSAGE_INTERVAL_MS);
    }
    const failure = await postMessage(webhookUrl, message.body, log, sleep);
    if (failure) {
      failedIds.push(...message.eventIds);
      failures.push({ ...failure, channel: "newPrintings" });
    } else {
      await onSent(message.eventIds);
      sentIds.push(...message.eventIds);
    }
  }

  return { sentIds, failedIds, failures };
}

export interface PrintingLabels {
  rarities: Record<string, string>;
  finishes: Record<string, string>;
  artVariants: Record<string, string>;
  cardSizes: Record<string, string>;
  languages: Record<string, string>;
  markers: Record<string, string>;
}

function cardUrl(appBaseUrl: string, slug: string | null): string | undefined {
  if (!slug) {
    return undefined;
  }
  return `${appBaseUrl}/cards/${slug}`;
}

function printingUrl(appBaseUrl: string, event: EnrichedPrintingEvent): string | undefined {
  const base = cardUrl(appBaseUrl, event.cardSlug);
  return base && `${base}/${encodeURIComponent(event.printingSlug)}`;
}

export function printingVariantParts(
  event: EnrichedPrintingEvent,
  labels: PrintingLabels,
): string[] {
  const { rest } = formatPrintingVariantLabelParts(
    {
      language: event.language ?? WellKnown.language.EN,
      artVariant: event.artVariant,
      finish: event.finish ?? WellKnown.finish.NORMAL,
      size: event.size,
      isSigned: event.isSigned,
      isOvernumbered: event.isOvernumbered,
      markers: event.markerSlugs.map((slug) => ({ slug, label: enumLabel(labels.markers, slug) })),
    },
    undefined,
    labels,
  );
  const language =
    event.language && event.language !== WellKnown.language.EN
      ? [enumLabel(labels.languages, event.language)]
      : [];
  return [...language, ...rest];
}

export function buildNewPrintingMessages(
  events: EnrichedPrintingEvent[],
  appBaseUrl: string,
  labels: PrintingLabels,
): NewPrintingMessage[] {
  if (events.length > SUMMARY_THRESHOLD) {
    return buildNewPrintingSummary(events, appBaseUrl, labels);
  }

  const siteName = appBaseUrl.replace(/^https?:\/\//u, "");

  const embeds = events.map((event): { embed: DiscordEmbed; eventId: string } => {
    const infoParts = [
      ...(event.setName ? [event.setName] : []),
      ...(event.shortCode ? [event.shortCode] : []),
      ...printingVariantParts(event, labels),
      ...(event.rarity ? [enumLabel(labels.rarities, event.rarity)] : []),
    ];
    const image = absoluteImageUrl(appBaseUrl, event.frontImageId);

    return {
      eventId: event.id,
      embed: {
        author: { name: siteName, url: appBaseUrl },
        title: `New: ${event.cardName ?? "Unknown Card"}`,
        url: printingUrl(appBaseUrl, event),
        color: COLOR_NEW,
        ...(image ? { image: { url: image } } : {}),
        ...(infoParts.length > 0 ? { footer: { text: infoParts.join(" · ") } } : {}),
        timestamp: event.createdAt.toISOString(),
      },
    };
  });

  const messages: NewPrintingMessage[] = [];
  for (let i = 0; i < embeds.length; i += MAX_EMBEDS_PER_MESSAGE) {
    const chunk = embeds.slice(i, i + MAX_EMBEDS_PER_MESSAGE);
    messages.push({
      body: { embeds: chunk.map((entry) => entry.embed) },
      eventIds: chunk.map((entry) => entry.eventId),
    });
  }
  return messages;
}

interface SummaryRow {
  text: string;
  eventIds: string[];
}

function setBlock(
  setName: string,
  setEvents: EnrichedPrintingEvent[],
  appBaseUrl: string,
  labels: PrintingLabels,
): { header: string; rows: SummaryRow[] } {
  const printings = setEvents
    .map((event) => ({ event, parts: printingVariantParts(event, labels) }))
    .toSorted((a, b) =>
      (a.event.shortCode ?? "").localeCompare(b.event.shortCode ?? "", "en", { numeric: true }),
    );
  const [first, ...others] = printings;
  const shared =
    first && others.length > 0
      ? first.parts.filter((part) => others.every((other) => other.parts.includes(part)))
      : [];

  const byCard = Map.groupBy(printings, (p) => `${p.event.cardSlug}\u0000${p.event.cardName}`);
  const rows = [...byCard.values()].map((cardPrintings) => {
    const links = cardPrintings.map(({ event, parts }) => {
      const text = [
        ...(event.shortCode ? [event.shortCode] : []),
        ...parts.filter((part) => !shared.includes(part)),
      ].join(" · ");
      const url = printingUrl(appBaseUrl, event);
      return url ? `[${text}](${url})` : text;
    });
    return {
      text: `${cardPrintings[0]?.event.cardName ?? "Unknown Card"}: ${links.join(", ")}`,
      eventIds: cardPrintings.map(({ event }) => event.id),
    };
  });
  const header = [`**${setName}**`, ...shared].join(" · ");
  return { header: `${header} (${setEvents.length})`, rows };
}

function buildNewPrintingSummary(
  events: EnrichedPrintingEvent[],
  appBaseUrl: string,
  labels: PrintingLabels,
): NewPrintingMessage[] {
  const [firstEvent] = events;
  if (!firstEvent) {
    return [];
  }
  const chunks: { description: string; eventIds: string[] }[] = [];
  let lines: string[] = [];
  let eventIds: string[] = [];
  let length = 0;
  const push = (line: string) => {
    lines.push(line);
    length += line.length + 1;
  };
  const flush = () => {
    chunks.push({ description: lines.join("\n"), eventIds });
    lines = [];
    eventIds = [];
    length = 0;
  };

  for (const [setName, setEvents] of Map.groupBy(events, (e) => e.setName ?? "Unknown Set")) {
    const { header, rows } = setBlock(setName, setEvents, appBaseUrl, labels);
    const opening = header.length + (rows[0]?.text.length ?? 0) + 3;
    if (lines.length > 0 && length + opening > MAX_DESCRIPTION_LENGTH) {
      flush();
    }
    if (lines.length > 0) {
      push("");
    }
    push(header);
    for (const row of rows) {
      if (length + row.text.length + 1 > MAX_DESCRIPTION_LENGTH) {
        flush();
        push(`${header} (continued)`);
      }
      push(row.text);
      eventIds.push(...row.eventIds);
    }
  }
  flush();

  return chunks.map((chunk, index) => ({
    body: {
      embeds: [
        {
          title: `${events.length} new printings added${index > 0 ? " (continued)" : ""}`,
          description: chunk.description,
          color: COLOR_NEW,
          timestamp: firstEvent.createdAt.toISOString(),
        },
      ],
    },
    eventIds: chunk.eventIds,
  }));
}

function parseRateLimitBody(body: string): { retry_after?: unknown } | null {
  try {
    return JSON.parse(body) as { retry_after?: unknown } | null;
  } catch {
    return null;
  }
}

function retryAfterMs(response: Response, body: string): number {
  const parsed = parseRateLimitBody(body);
  if (typeof parsed?.retry_after === "number") {
    return Math.ceil(parsed.retry_after * 1000);
  }
  const header = Number(response.headers.get("retry-after") ?? Number.NaN);
  return Number.isFinite(header) ? header * 1000 : DEFAULT_RETRY_AFTER_MS;
}

async function postMessage(
  webhookUrl: string,
  body: DiscordWebhookPayload,
  log: Logger,
  sleep: (ms: number) => Promise<unknown>,
): Promise<{ status?: number; detail: string } | null> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log.warn({ error }, "Discord webhook request error");
      return { detail };
    }
    if (response.ok) {
      return null;
    }
    const text = await response.text().catch(() => "");
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitMs = retryAfterMs(response, text);
      if (waitMs <= MAX_RETRY_AFTER_MS) {
        log.warn({ waitMs, attempt }, "Discord webhook rate limited, waiting");
        await sleep(waitMs);
        continue;
      }
    }
    log.warn({ status: response.status, body: text }, "Discord webhook request failed");
    return { status: response.status, detail: text };
  }
}
