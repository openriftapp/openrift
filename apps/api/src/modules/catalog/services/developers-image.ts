import { rulesTeaser } from "@openrift/shared/rules-teaser";
import { SHARE_IMAGE_CANVAS } from "@openrift/shared/share-image-params";

import type { Io } from "../../../io.js";
import type { Child, Element } from "../../system/services/share-image-core.js";
import {
  COLORS,
  cardTile,
  element,
  elideTitle,
  renderTreeToPng,
  svgToPngDataUri,
  tileArtDataUri,
} from "../../system/services/share-image-core.js";
import type { DevelopersImageInput, DevelopersShowcase } from "./developers-image-input.js";

const ACCENT = "#3ee0cf";
const BACKGROUND = "#121620";
const PANEL = "#1b1f27";
const PANEL_BORDER = "#3a3f4a";
const MUTED = "#a3a9b4";
const DISPLAY_FONT = "Chakra Petch";
const MONO_FONT = "JetBrains Mono";

const PAD = 64;
const CARD = { left: 830, top: 120, w: 290, h: 405 };
const BACKDROPS = [
  { left: 930, top: 70, rotate: 9, shade: 0.55 },
  { left: 1010, top: 150, rotate: 18, shade: 0.7 },
];

const PANEL_BOX = { top: 232, w: 600, h: 344, padX: 24, padY: 20 };
const CODE_SIZE = 19;
const CODE_LINE = 28;
const PROMPT_GAP = 20;
const FIRST_FIELD_Y = PANEL_BOX.top + PANEL_BOX.padY + CODE_LINE + PROMPT_GAP + CODE_LINE;
const VALUE_MAX_CHARS = 20;

const CONNECTOR_START_X = PAD + PANEL_BOX.w + 4;
const BEND_FROM = 700;
const BEND_TO = 810;

interface Field {
  key: string;
  value: Child[];
  anchor?: { x: number; y: number };
}

function str(value: string): Element {
  return element("span", { color: COLORS.gold }, `"${value}"`);
}

function list(values: string[]): Child[] {
  return [
    "[",
    ...values.flatMap((value, index) => (index === 0 ? [str(value)] : [", ", str(value)])),
    "]",
  ];
}

function showcaseFields(showcase: DevelopersShowcase): Field[] {
  const fields: Field[] = [];
  if (showcase.energy !== null) {
    fields.push({ key: "energy", value: [String(showcase.energy)], anchor: { x: 0.11, y: 0.1 } });
  }
  if (showcase.tags.length > 0) {
    fields.push({ key: "tags", value: list(showcase.tags), anchor: { x: 0.55, y: 0.53 } });
  }
  fields.push({
    key: "name",
    value: [str(elideTitle(showcase.name, VALUE_MAX_CHARS))],
    anchor: { x: 0.24, y: 0.585 },
  });
  if (showcase.domains.length > 0) {
    fields.push({ key: "domains", value: list(showcase.domains), anchor: { x: 0.035, y: 0.635 } });
  }
  if (showcase.rulesText) {
    fields.push({
      key: "printedRulesText",
      value: [str(rulesTeaser(showcase.rulesText, 17))],
      anchor: { x: 0.1, y: 0.72 },
    });
  }
  fields.push({
    key: "publicCode",
    value: [str(showcase.publicCode)],
    anchor: { x: 0.1, y: 0.97 },
  });
  return fields;
}

function connectorSvg(fields: Field[]): string {
  const { width, height } = SHARE_IMAGE_CANVAS.landscape;
  const paths: string[] = [];
  const dots: string[] = [];
  for (const [index, field] of fields.entries()) {
    if (!field.anchor) {
      continue;
    }
    const y0 = FIRST_FIELD_Y + index * CODE_LINE + CODE_LINE / 2;
    const x1 = Math.round(CARD.left + field.anchor.x * CARD.w);
    const y1 = Math.round(CARD.top + field.anchor.y * CARD.h);
    const mid = (BEND_FROM + BEND_TO) / 2;
    paths.push(
      `<path d="M${CONNECTOR_START_X} ${y0} L${BEND_FROM} ${y0} C${mid} ${y0} ${mid} ${y1} ${BEND_TO} ${y1} L${x1} ${y1}"/>`,
    );
    dots.push(
      `<circle cx="${CONNECTOR_START_X}" cy="${y0}" r="4"/><circle cx="${x1}" cy="${y1}" r="6"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="4 5" opacity="0.85">${paths.join("")}</g><g fill="${ACCENT}">${dots.join("")}</g></svg>`;
}

function codeLine(indent: boolean, ...children: Child[]): Element {
  return element(
    "div",
    { display: "flex", height: CODE_LINE, paddingLeft: indent ? CODE_SIZE * 1.2 : 0 },
    ...children,
  );
}

function codePanel(fields: Field[], siteHost: string): Element {
  const lines = fields.map((field) =>
    codeLine(true, element("span", { color: ACCENT }, `"${field.key}"`), ": ", ...field.value, ","),
  );
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      position: "absolute",
      left: PAD,
      top: PANEL_BOX.top,
      width: PANEL_BOX.w,
      height: PANEL_BOX.h,
      padding: `${PANEL_BOX.padY}px ${PANEL_BOX.padX}px`,
      borderRadius: 12,
      backgroundColor: PANEL,
      border: `1px solid ${PANEL_BORDER}`,
      fontFamily: MONO_FONT,
      fontSize: CODE_SIZE,
      lineHeight: `${CODE_LINE}px`,
      whiteSpace: "pre",
    },
    codeLine(false, element("span", { color: MUTED }, "$ "), `curl ${siteHost}/api/v1/catalog`),
    element("div", { display: "flex", height: PROMPT_GAP }),
    codeLine(false, "{"),
    ...lines,
    codeLine(true, element("span", { color: MUTED }, "…")),
    codeLine(false, "}"),
  );
}

function pill(label: string): Element {
  return element(
    "div",
    {
      display: "flex",
      padding: "6px 14px",
      borderRadius: 999,
      border: `1px solid ${PANEL_BORDER}`,
      fontSize: 20,
      fontWeight: 600,
      color: COLORS.gold,
    },
    label,
  );
}

function placedCard(
  art: string | null,
  name: string,
  box: { left: number; top: number; rotate: number },
  shade: number,
): Element {
  return element(
    "div",
    {
      display: "flex",
      position: "absolute",
      left: box.left,
      top: box.top,
      width: CARD.w,
      height: CARD.h,
      transform: `rotate(${box.rotate}deg)`,
      borderRadius: 14,
      boxShadow: shade === 0 ? "0 24px 60px rgba(0,0,0,0.6)" : undefined,
    },
    cardTile({ cardName: name }, art, CARD.w, CARD.h),
    shade > 0 &&
      element("div", {
        display: "flex",
        position: "absolute",
        inset: 0,
        borderRadius: 14,
        backgroundColor: `rgba(10,12,18,${shade})`,
      }),
  );
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export async function renderDevelopersImage(
  io: Io,
  input: DevelopersImageInput,
  scale = 1,
): Promise<Buffer> {
  const { width, height } = SHARE_IMAGE_CANVAS.landscape;
  const siteHost = input.siteHost ?? "openrift.app";
  const fields = input.showcase ? showcaseFields(input.showcase) : [];

  const [logo, showcaseArt, ...backdropArts] = await Promise.all([
    io.fs
      .readFile(`${import.meta.dirname}/../../../assets/logo-color.svg`)
      .then((svg) => svgToPngDataUri(io, svg, 36 * scale, 1024))
      .catch(() => null),
    input.showcase
      ? tileArtDataUri(io, input.showcase.imageId, CARD.w, CARD.h, scale)
      : Promise.resolve(null),
    ...input.backdropImageIds
      .slice(0, BACKDROPS.length)
      .map((imageId) => tileArtDataUri(io, imageId, CARD.w, CARD.h, scale)),
  ]);

  const connectors =
    fields.length > 0
      ? `data:image/svg+xml;base64,${Buffer.from(connectorSvg(fields)).toString("base64")}`
      : null;

  const { stats } = input;
  const root = element(
    "div",
    {
      display: "flex",
      position: "relative",
      width,
      height,
      backgroundColor: BACKGROUND,
      color: COLORS.text,
      fontFamily: "Hanken Grotesk",
      overflow: "hidden",
    },
    ...backdropArts.map((art, index) => {
      const box = BACKDROPS[index];
      return box ? placedCard(art, "", { ...box }, box.shade) : null;
    }),
    input.showcase && placedCard(showcaseArt, input.showcase.name, { ...CARD, rotate: 0 }, 0),
    connectors && {
      type: "img",
      props: {
        src: connectors,
        width,
        height,
        style: { position: "absolute", left: 0, top: 0 },
      },
    },
    element(
      "div",
      {
        display: "flex",
        position: "absolute",
        left: PAD,
        top: 44,
        alignItems: "center",
        gap: 12,
      },
      logo && { type: "img", props: { src: logo, width: 36, height: 36 } },
      element("span", { fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 24 }, "OpenRift"),
      element("span", { fontSize: 22, color: MUTED }, "/ developers"),
    ),
    element(
      "div",
      {
        display: "flex",
        position: "absolute",
        left: PAD,
        top: 92,
        fontFamily: DISPLAY_FONT,
        fontWeight: 700,
        fontSize: 68,
        lineHeight: 1,
      },
      "Riftbound API",
    ),
    element(
      "div",
      { display: "flex", position: "absolute", left: PAD, top: 176, gap: 10 },
      pill("Free"),
      pill("No API key"),
      pill("JSON"),
    ),
    codePanel(fields, siteHost),
    element(
      "div",
      { display: "flex", position: "absolute", left: PAD, top: 592, fontSize: 20, color: MUTED },
      `${formatCount(stats.cards)} cards · ${formatCount(stats.printings)} printings · ${formatCount(stats.sets)} sets · ${formatCount(stats.languages)} languages`,
    ),
  );

  const png = await renderTreeToPng(io, root, width, height, scale);
  // Messengers drop link-preview images over roughly 300 KB; the raw render is ~400 KB.
  return io.sharp(png).png({ palette: true, quality: 90 }).toBuffer();
}
