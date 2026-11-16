import { auditBooster } from "@openrift/shared/boosters/audit";
import { BOOSTERS } from "@openrift/shared/boosters/definitions";
import { toBoosterPrintings } from "@openrift/shared/boosters/input";
import type { BoosterPrinting } from "@openrift/shared/boosters/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { StatStrip } from "@/components/ui/stat-strip";
import { TextLink } from "@/components/ui/text-link";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import { adminProductPrintingIdsQueryOptions } from "@/features/admin/lib/booster-pools-queries";
import { BoosterSlotTable } from "@/features/boosters/components/booster-page";
import { boosterOutcomeLabel, boosterSlotLabel } from "@/features/boosters/lib/booster-labels";
import { publicSetDetailQueryOptions } from "@/features/cards/lib/public-sets-queries";

const BOOSTER_SLUGS = Object.keys(BOOSTERS);

export function BoosterPoolsPage() {
  const [slug, setSlug] = useState(BOOSTER_SLUGS[0] ?? "");
  const [language, setLanguage] = useState("EN");
  const definition = BOOSTERS[slug];
  const languages = Object.keys(definition?.languages ?? {});
  const shownLanguage = languages.includes(language) ? language : (languages[0] ?? "EN");
  return (
    <div className="flex flex-col gap-6">
      <AdminPageTopBar title="Booster Pools" />
      <p className="text-muted-foreground">
        Read-only. Boosters, slots and rates live in shared code. Fix a wrong pool by fixing the
        printing&apos;s marker, channel or product.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 space-y-1">
          <Label>Booster</Label>
          <SimpleSelect
            items={BOOSTER_SLUGS.map((value) => ({ value, label: value }))}
            value={slug}
            onChange={setSlug}
            label="Booster"
            className="w-full"
          />
        </div>
        <div className="min-w-32 space-y-1">
          <Label>Language</Label>
          <SimpleSelect
            items={languages.map((value) => ({ value, label: value }))}
            value={shownLanguage}
            onChange={setLanguage}
            label="Language"
            className="w-full"
          />
        </div>
        <div className="flex h-(--control-h) items-center">
          <TextLink render={<Link to="/products/$slug" params={{ slug }} />}>
            Public product page
          </TextLink>
        </div>
      </div>
      {definition && (
        <BoosterAuditView slug={slug} setSlug={definition.set} language={shownLanguage} />
      )}
    </div>
  );
}

function BoosterAuditView({
  slug,
  setSlug,
  language,
}: {
  slug: string;
  setSlug: string;
  language: string;
}) {
  const { data: setDetail } = useSuspenseQuery(publicSetDetailQueryOptions(setSlug));
  const { data: products } = useSuspenseQuery(adminProductPrintingIdsQueryOptions);
  const audit = auditBooster(
    slug,
    toBoosterPrintings(setDetail.printings),
    new Set(products.printingIds),
  );
  const current = audit?.languages.find((entry) => entry.booster.language === language);
  if (!audit || !current) {
    return <p className="text-muted-foreground">No printings of this set in {language}.</p>;
  }
  const { booster } = current;
  return (
    <div className="flex flex-col gap-6">
      <StatStrip
        items={[
          { key: "total", value: current.total, label: `printings in ${setSlug}, ${language}` },
          { key: "pools", value: current.inPools, label: "in a pack pool" },
          { key: "marked", value: current.markedOrChannel, label: "marker or channel" },
          { key: "product", value: current.oversizedOrProduct, label: "oversized or product only" },
          {
            key: "nothing",
            value: current.unreached.length,
            label: "reached by nothing",
            tone: current.unreached.length === 0 ? "success" : "warning",
          },
          {
            key: "overlaps",
            value: current.overlaps.length,
            label: "in-slot overlaps",
            tone: current.overlaps.length === 0 ? "success" : "destructive",
          },
        ]}
      />
      {!booster.openable && (
        <p className="text-warning">
          A fill pool is empty, so this language shows no odds and cannot be opened.
        </p>
      )}
      <AuditSection title="Reached by nothing" count={current.unreached.length}>
        <PrintingList printings={current.unreached} />
      </AuditSection>
      <AuditSection title="In-slot overlaps" count={current.overlaps.length}>
        <ul className="flex flex-col gap-1">
          {current.overlaps.map((overlap) => (
            <li key={`${overlap.slot}-${overlap.printing.printingId}`}>
              {overlap.printing.shortCode} in {boosterSlotLabel(overlap.slot)}:{" "}
              {overlap.outcomes.map((outcome) => boosterOutcomeLabel(outcome)).join(", ")}
            </li>
          ))}
        </ul>
      </AuditSection>
      <AuditSection title="Missing in a language" count={audit.missing.length}>
        <AdminTable
          columns={[
            { header: "Short code", cell: <MissingCell part="code" /> },
            { header: "Outcome", cell: <MissingCell part="outcome" /> },
            { header: "Missing in", cell: <MissingCell part="languages" /> },
          ]}
          data={audit.missing}
          getRowKey={(row) => `${row.shortCode}-${row.slot}-${row.outcome}`}
        />
      </AuditSection>
      <AuditSection title="From a booster channel" count={current.exclusives.length}>
        <PrintingList printings={current.exclusives} />
      </AuditSection>
      <AuditSection title="Acknowledged" count={current.acknowledged.length}>
        <PrintingList printings={current.acknowledged} />
      </AuditSection>
      <section className="flex flex-col gap-3">
        <Heading level={3}>Outcomes</Heading>
        <BoosterSlotTable booster={booster} />
      </section>
    </div>
  );
}

function AuditSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <Heading level={3}>
        {title} <span className="text-muted-foreground tabular-nums">{count}</span>
      </Heading>
      {count > 0 && children}
    </section>
  );
}

function PrintingList({ printings }: { printings: readonly BoosterPrinting[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {printings.map(({ printingId, printing }) => (
        <li key={printingId}>
          <Link
            to="/admin/cards/$cardSlug"
            params={{ cardSlug: printing.card.slug }}
            className="hover:text-foreground"
          >
            <span className="text-muted-foreground mr-2 tabular-nums">{printing.shortCode}</span>
            {printing.card.name}
          </Link>{" "}
          <span className="text-muted-foreground">
            {printing.rarity} · {printing.finish} · {printing.artVariant} · {printing.size}
          </span>
        </li>
      ))}
    </ul>
  );
}

type MissingRow = NonNullable<ReturnType<typeof auditBooster>>["missing"][number];

function MissingCell({
  row,
  part,
}: AdminCellSlotProps<MissingRow> & { part: "code" | "outcome" | "languages" }) {
  if (!row) {
    return null;
  }
  if (part === "code") {
    return <span className="tabular-nums">{row.shortCode}</span>;
  }
  if (part === "outcome") {
    return (
      <span>
        {boosterSlotLabel(row.slot)} › {boosterOutcomeLabel(row.outcome)}
      </span>
    );
  }
  return <span>{row.missingIn.join(", ")}</span>;
}
