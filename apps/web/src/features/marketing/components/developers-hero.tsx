import { rulesTeaser } from "@openrift/shared/rules-teaser";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";

export interface DevelopersShowcaseCard {
  name: string;
  energy: number | null;
  tags: string[];
  domains: string[];
  rulesText: string | null;
  publicCode: string;
  imageSrc: string | null;
}

interface Field {
  key: string;
  value: ReactNode;
  anchor: { x: number; y: number };
}

const LINE = 28;
const PANEL_PAD = 20;
const PROMPT_GAP = 16;
const FIRST_FIELD_CENTER = PANEL_PAD + LINE + PROMPT_GAP + LINE + LINE / 2;
const CARD_W = 260;
const CARD_H = 363;
const GAP_W = 120;
const BEND_FROM = 20;
const BEND_TO = 100;

function Str({ children }: { children: string }) {
  return <span className="text-primary">&quot;{children}&quot;</span>;
}

function List({ values }: { values: string[] }) {
  return (
    <>
      [
      {values.map((value, index) => (
        <span key={value}>
          {index > 0 && ", "}
          <Str>{value}</Str>
        </span>
      ))}
      ]
    </>
  );
}

function fields(card: DevelopersShowcaseCard): Field[] {
  const rows: Field[] = [];
  if (card.energy !== null) {
    rows.push({ key: "energy", value: String(card.energy), anchor: { x: 0.11, y: 0.1 } });
  }
  if (card.tags.length > 0) {
    rows.push({ key: "tags", value: <List values={card.tags} />, anchor: { x: 0.55, y: 0.53 } });
  }
  rows.push({ key: "name", value: <Str>{card.name}</Str>, anchor: { x: 0.24, y: 0.585 } });
  if (card.domains.length > 0) {
    rows.push({
      key: "domains",
      value: <List values={card.domains} />,
      anchor: { x: 0.035, y: 0.635 },
    });
  }
  if (card.rulesText) {
    rows.push({
      key: "printedRulesText",
      value: <Str>{rulesTeaser(card.rulesText, 17)}</Str>,
      anchor: { x: 0.1, y: 0.72 },
    });
  }
  rows.push({
    key: "publicCode",
    value: <Str>{card.publicCode}</Str>,
    anchor: { x: 0.1, y: 0.97 },
  });
  return rows;
}

function Connectors({ rows }: { rows: Field[] }) {
  return (
    <svg
      aria-hidden="true"
      className="text-info pointer-events-none absolute top-0 left-0 z-10 overflow-visible"
      width={GAP_W}
      height={CARD_H}
    >
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 5" opacity={0.85}>
        {rows.map((row, index) => {
          const y0 = FIRST_FIELD_CENTER + index * LINE;
          const x1 = GAP_W + row.anchor.x * CARD_W;
          const y1 = row.anchor.y * CARD_H;
          const mid = (BEND_FROM + BEND_TO) / 2;
          return (
            <path
              key={row.key}
              d={`M0 ${y0} L${BEND_FROM} ${y0} C${mid} ${y0} ${mid} ${y1} ${BEND_TO} ${y1} L${x1} ${y1}`}
            />
          );
        })}
      </g>
      <g fill="currentColor">
        {rows.map((row, index) => (
          <g key={row.key}>
            <circle cx={0} cy={FIRST_FIELD_CENTER + index * LINE} r={4} />
            <circle cx={GAP_W + row.anchor.x * CARD_W} cy={row.anchor.y * CARD_H} r={6} />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function DevelopersHero({
  origin,
  card,
  lead,
}: {
  origin: string;
  card: DevelopersShowcaseCard | null;
  lead: ReactNode;
}) {
  const rows = card ? fields(card) : [];

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-2">
        {[m.developers_pill_free(), m.developers_pill_no_key(), "JSON"].map((label) => (
          <li
            key={label}
            className="border-border text-primary rounded-full border px-3 py-1 text-sm font-semibold"
          >
            {label}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground">{lead}</p>

      <div className="flex items-start">
        <pre
          className="bg-card border-border min-w-0 flex-1 overflow-x-auto rounded-xl border font-mono text-sm"
          style={{ padding: PANEL_PAD, lineHeight: `${LINE}px` }}
        >
          <code>
            <span className="block">
              <span className="text-muted-foreground">$ </span>
              {`curl ${origin}/api/v1/catalog`}
            </span>
            <span className="block" style={{ height: PROMPT_GAP }} />
            <span className="block">{"{"}</span>
            {rows.map((row) => (
              <span key={row.key} className="block pl-[2ch]">
                <span className="text-info">&quot;{row.key}&quot;</span>: {row.value},
              </span>
            ))}
            <span className="text-muted-foreground block pl-[2ch]">…</span>
            <span className="block">{"}"}</span>
          </code>
        </pre>

        {card?.imageSrc && (
          <div className="relative hidden shrink-0 lg:flex">
            <div className="relative" style={{ width: GAP_W }}>
              <Connectors rows={rows} />
            </div>
            <img
              src={card.imageSrc}
              alt={card.name}
              width={CARD_W}
              height={CARD_H}
              className="rounded-xl shadow-2xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}
