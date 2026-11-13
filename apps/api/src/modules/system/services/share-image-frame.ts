import type { ShareImageAspect } from "@openrift/shared/share-image-params";

import type { Child, Element } from "./share-image-core.js";
import { COLORS, element, elideTitle, qrMark } from "./share-image-core.js";

export interface ShareTypeScale {
  pad: number;
  titleH: number;
  titleSize: number;
  bylineSize: number;
  metaSize: number;
  titleMaxChars: number;
  headerQr: number;
  footerH: number;
  footerSize: number;
}

export const SHARE_TYPE: Record<ShareImageAspect, ShareTypeScale> = {
  landscape: {
    pad: 24,
    titleH: 52,
    titleSize: 34,
    bylineSize: 22,
    metaSize: 20,
    titleMaxChars: 46,
    headerQr: 104,
    footerH: 26,
    footerSize: 20,
  },
  vertical: {
    pad: 28,
    titleH: 92,
    titleSize: 46,
    bylineSize: 28,
    metaSize: 26,
    titleMaxChars: 30,
    headerQr: 132,
    footerH: 32,
    footerSize: 24,
  },
};

export const GOLD_GLOW =
  "radial-gradient(80% 120% at 0% 0%, rgba(205,172,110,0.14) 0%, transparent 60%)";

const QR_GAP = 16;

export function shareCanvas(
  width: number,
  height: number,
  style: Record<string, unknown>,
  ...children: Child[]
): Element {
  return element(
    "div",
    {
      display: "flex",
      width,
      height,
      backgroundColor: COLORS.background,
      color: COLORS.text,
      fontFamily: "Hanken Grotesk",
      overflow: "hidden",
      ...style,
    },
    ...children,
  );
}

export function hostLabel(host: string, fontSize: number, color: string = COLORS.muted): Element {
  return element("div", { display: "flex", fontSize, fontWeight: 600, color }, host);
}

interface HostFooterOptions {
  siteHost?: string;
  aspect: ShareImageAspect;
  marginTop: number;
  height?: number;
  color?: string;
  trailing?: Child;
}

export function hostFooter(options: HostFooterOptions): Element {
  const scale = SHARE_TYPE[options.aspect];
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      height: options.height ?? scale.footerH,
      marginTop: options.marginTop,
      flexShrink: 0,
    },
    options.siteHost ? hostLabel(options.siteHost, scale.footerSize, options.color) : false,
    options.trailing ? element("div", { display: "flex", flexGrow: 1 }) : false,
    options.trailing,
  );
}

interface TitleBlockOptions {
  aspect: ShareImageAspect;
  title: string;
  maxChars?: number;
  titleMaxWidth?: number;
  ownerName?: string;
  meta?: string;
  metaTrailing?: Child;
  extra?: Child;
  qrUri?: string | null;
  height: number;
  typeHeight?: number;
}

function bylineText(ownerName: string): string {
  return `by ${ownerName}`;
}

function metaRun(
  scale: ShareTypeScale,
  meta: string,
  trailing: Child,
  landscape: boolean,
): Child[] {
  const text = element(
    "div",
    {
      display: "flex",
      ...(landscape ? { flexShrink: 0 } : {}),
      fontSize: scale.metaSize,
      lineHeight: 1,
      color: COLORS.muted,
    },
    meta,
  );
  if (!trailing) {
    return [text];
  }
  if (landscape) {
    return [
      element(
        "div",
        { display: "flex", flexDirection: "row", alignItems: "center", flexShrink: 0 },
        text,
        trailing,
      ),
    ];
  }
  return [text, trailing];
}

function landscapeType(options: TitleBlockOptions, scale: ShareTypeScale): Element {
  const runs = element(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      alignItems: "baseline",
      ...(options.extra ? {} : { flexGrow: 1 }),
    },
    element(
      "div",
      {
        display: "flex",
        flexShrink: 1,
        fontSize: scale.titleSize,
        lineHeight: 1,
        fontWeight: 700,
        color: COLORS.text,
        ...(options.titleMaxWidth === undefined ? {} : { maxWidth: options.titleMaxWidth }),
        whiteSpace: "nowrap",
      },
      elideTitle(options.title, options.maxChars ?? scale.titleMaxChars),
    ),
    options.ownerName
      ? element(
          "div",
          {
            display: "flex",
            flexShrink: 0,
            marginLeft: 12,
            fontSize: scale.bylineSize,
            lineHeight: 1,
            fontWeight: 600,
            color: COLORS.gold,
          },
          bylineText(options.ownerName),
        )
      : false,
    element("div", { display: "flex", flexGrow: 1, minWidth: 24 }),
    ...(options.meta === undefined ? [] : metaRun(scale, options.meta, options.metaTrailing, true)),
  );
  return options.extra
    ? element("div", { display: "flex", flexDirection: "column", flexGrow: 1 }, runs, options.extra)
    : runs;
}

function verticalType(options: TitleBlockOptions, scale: ShareTypeScale): Element {
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      flexGrow: 1,
      height: options.typeHeight ?? scale.titleH,
    },
    element(
      "div",
      {
        display: "flex",
        fontSize: scale.titleSize,
        lineHeight: 1,
        fontWeight: 700,
        color: COLORS.text,
        whiteSpace: "nowrap",
      },
      elideTitle(options.title, options.maxChars ?? scale.titleMaxChars),
    ),
    element(
      "div",
      { display: "flex", flexDirection: "row", alignItems: "center", marginTop: 14 },
      options.ownerName
        ? element(
            "div",
            {
              display: "flex",
              fontSize: scale.bylineSize,
              lineHeight: 1,
              fontWeight: 600,
              color: COLORS.gold,
            },
            bylineText(options.ownerName),
          )
        : false,
      element("div", { display: "flex", flexGrow: 1, minWidth: 24 }),
      ...(options.meta === undefined
        ? []
        : metaRun(scale, options.meta, options.metaTrailing, false)),
    ),
    options.extra,
  );
}

export function titleBlock(options: TitleBlockOptions): Element {
  const scale = SHARE_TYPE[options.aspect];
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      height: options.height,
      flexShrink: 0,
    },
    options.aspect === "vertical" ? verticalType(options, scale) : landscapeType(options, scale),
    options.qrUri
      ? element(
          "div",
          { display: "flex", flexShrink: 0, marginLeft: QR_GAP },
          qrMark(options.qrUri, scale.headerQr),
        )
      : false,
  );
}

export function titleAreaHeight(
  aspect: ShareImageAspect,
  withQr: boolean,
  typeHeight?: number,
): number {
  const scale = SHARE_TYPE[aspect];
  const typeH = typeHeight ?? scale.titleH;
  return withQr ? Math.max(typeH, scale.headerQr) : typeH;
}
