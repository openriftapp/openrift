import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { enumLabel } from "@openrift/shared/enum-label";
import { ChevronDownIcon, ChevronRightIcon, FileUpIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Eyebrow, Heading } from "@/components/heading";
import { PROSE_MARKUP, linkMarkup } from "@/components/message-markup";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { ImportRowShell } from "@/features/collections/components/import-row-shell";
import { IMPORT_BUCKET_ICONS } from "@/features/collections/lib/import-bucket-icons";
import type { ImportBucket } from "@/features/collections/lib/import-summary";
import { useEnumOrders } from "@/hooks/use-enums";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export default function ImportExportArticle() {
  const { labels } = useEnumOrders();
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        <ParaglideMessage
          message={m.help_import_export_intro}
          markup={{
            strong: PROSE_MARKUP.strong,
            link: linkMarkup("/collections"),
          }}
        />
      </p>

      <section>
        <Heading className="mb-2">{m.help_import_export_importing_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_import_export_importing_p} markup={PROSE_MARKUP} />
        </p>
      </section>

      <section>
        <Heading level={3} className="mb-2">
          {m.help_import_export_step1_heading()}
        </Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_import_export_step1_p} markup={PROSE_MARKUP} />
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormatCard
            name="OpenRift"
            description={m.help_import_export_format_openrift_desc()}
            columns={[
              "Card ID",
              "Card Name",
              "Rarity",
              "Type",
              "Domain",
              "Finish",
              "Art Variant",
              "Promo",
              "Quantity",
            ]}
          />
          <FormatCard
            name="Piltover Archive"
            description={m.help_import_export_format_piltover_desc()}
            columns={[
              "Variant Number",
              "Card Name",
              "Set",
              "Set Prefix",
              "Rarity",
              "Variant Type",
              "Variant Label",
              "Quantity",
              "Foil",
              "Language",
              "Condition",
            ]}
          />
          <FormatCard
            name="RiftCore"
            description={m.help_import_export_format_riftcore_desc()}
            columns={[
              "Card ID",
              "Card Name",
              "Set",
              "Card Number",
              "Type",
              "Rarity",
              "Domain",
              "Standard Qty",
              "Foil Qty",
            ]}
          />
          <FormatCard
            name="RiftMana"
            description={m.help_import_export_format_riftmana_desc()}
            columns={[
              "Card ID",
              "Card Name",
              "Set",
              "Color",
              "Rarity",
              "Normal Qty",
              "Foil Qty",
              "Normal Condition",
              "Foil Condition",
              "Language",
            ]}
          />
        </div>

        <p className="text-muted-foreground mt-3">
          <ParaglideMessage
            message={m.help_import_export_other_tools}
            markup={{
              link: ({ children }) => (
                <TextLink href={SOCIAL_LINKS.discordInvite} target="_blank" rel="noreferrer">
                  {children}
                </TextLink>
              ),
              link2: ({ children }) => (
                <TextLink href={SOCIAL_LINKS.githubIssues} target="_blank" rel="noreferrer">
                  {children}
                </TextLink>
              ),
            }}
          />
        </p>
      </section>

      <section>
        <Heading level={3} className="mb-2">
          {m.help_import_export_step2_heading()}
        </Heading>
        <p className="text-muted-foreground">{m.help_import_export_step2_p()}</p>

        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm icon={<BucketIcon bucket="ready" />}>
            {m.help_import_export_status_exact()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_import_export_status_exact_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<BucketIcon bucket="to-verify" />}>
            {m.help_import_export_status_review()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_import_export_status_review_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<BucketIcon bucket="need-attention" />}>
            {m.help_import_export_status_unresolved()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_import_export_status_unresolved_detail()}</DefinitionDetail>
        </DefinitionList>

        <Callout className="mt-4">
          <Eyebrow className="mb-3">{m.help_import_export_example_preview()}</Eyebrow>
          <div className="divide-border bg-background divide-y rounded-md">
            <MockImportRow
              bucket="to-verify"
              quantity={1}
              code="OGN-001"
              name="Blazing Scorcher"
              suffix={enumLabel(labels.finishes, "foil")}
              actions={
                <span className="bg-background flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs">
                  OGN-001 · {enumLabel(labels.finishes, "foil")}
                  <ChevronDownIcon className="text-muted-foreground size-3" />
                </span>
              }
            />
            <MockImportRow
              bucket="need-attention"
              quantity={1}
              name="Fury Runne"
              actions={
                <span className="text-muted-foreground text-xs">
                  <ParaglideMessage
                    message={m.collections_import_did_you_mean}
                    inputs={{ name: "Fury Rune" }}
                    markup={{ em: ({ children }) => <em>{children}</em> }}
                  />
                </span>
              }
            />
            <MockImportRow bucket="ready" quantity={3} code="OGN-007" name="Fury Rune" />
          </div>
        </Callout>

        <p className="text-muted-foreground mt-3">
          <ParaglideMessage message={m.help_import_export_review_p1} markup={PROSE_MARKUP} />
        </p>

        <p className="text-muted-foreground mt-2">
          <ParaglideMessage message={m.help_import_export_review_p2} markup={PROSE_MARKUP} />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_import_export_exporting_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_import_export_export_p} markup={PROSE_MARKUP} />
        </p>

        <div className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Card ID",
                  "Card Name",
                  "Rarity",
                  "Type",
                  "Domain",
                  "Finish",
                  "Art Variant",
                  "Promo",
                  "Quantity",
                ].map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <ExampleExportRow
                values={[
                  "OGN-001",
                  "Blazing Scorcher",
                  "common",
                  "unit",
                  "fury",
                  "Foil",
                  "normal",
                  "nexus",
                  "1",
                ]}
              />
              <ExampleExportRow
                values={[
                  "OGN-007",
                  "Fury Rune",
                  "common",
                  "rune",
                  "fury",
                  "Normal",
                  "normal",
                  "",
                  "3",
                ]}
              />
              <ExampleExportRow
                values={[
                  "OGN-007a",
                  "Fury Rune",
                  "showcase",
                  "rune",
                  "fury",
                  "Foil",
                  "altart",
                  "",
                  "1",
                ]}
              />
            </TableBody>
          </Table>
        </div>

        <p className="text-muted-foreground mt-3">
          <ParaglideMessage
            message={m.help_import_export_file_p}
            markup={{
              code: PROSE_MARKUP.code,
              em: PROSE_MARKUP.em,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_import_export_matching_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_import_export_matching_p()}</p>
        <ol className="text-muted-foreground mt-2 list-inside list-decimal space-y-2">
          <li>
            <strong className="text-foreground">
              {m.help_import_export_matching_code_label()}
            </strong>{" "}
            <ParaglideMessage
              message={m.help_import_export_matching_code}
              markup={{
                code: PROSE_MARKUP.code,
                link: linkMarkup("/cards"),
              }}
            />
          </li>
          <li>
            <strong className="text-foreground">
              {m.help_import_export_matching_name_label()}
            </strong>{" "}
            {m.help_import_export_matching_name_detail()}
          </li>
          <li>
            <strong className="text-foreground">
              {m.help_import_export_matching_unresolved_label()}
            </strong>{" "}
            {m.help_import_export_matching_unresolved_detail()}
          </li>
        </ol>
      </section>
    </div>
  );
}

function FormatCard({
  name,
  description,
  columns,
}: {
  name: string;
  description: string;
  columns: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUpIcon className="text-primary size-4" />
          {name}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1">
        {columns.map((column) => (
          <span
            key={column}
            className="bg-muted text-muted-foreground text-2xs rounded-md px-1.5 py-0.5 font-mono"
          >
            {column}
          </span>
        ))}
      </CardContent>
    </Card>
  );
}

function BucketIcon({ bucket }: { bucket: ImportBucket }) {
  const { icon: Icon, className } = IMPORT_BUCKET_ICONS[bucket];
  return <Icon className={cn("size-4 shrink-0", className)} />;
}

function MockImportRow({
  bucket,
  quantity,
  code,
  name,
  suffix,
  actions,
}: {
  bucket: ImportBucket;
  quantity: number;
  code?: string;
  name: string;
  suffix?: string;
  actions?: ReactNode;
}) {
  return (
    <ImportRowShell
      chevron={<ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />}
      statusIcon={<BucketIcon bucket={bucket} />}
      quantity={quantity}
      code={code}
      name={name}
      nameSuffix={suffix}
      actions={
        <>
          {actions}
          <span className={buttonVariants({ variant: "ghost", size: "xs" })}>
            <SearchIcon className="size-3.5" />
          </span>
          <span className={buttonVariants({ variant: "ghost", size: "xs" })}>
            {m.collections_import_skip()}
          </span>
        </>
      }
    />
  );
}

function ExampleExportRow({ values }: { values: string[] }) {
  return (
    <TableRow>
      {values.map((value, index) => (
        <TableCell
          key={index}
          className={index === 0 ? "font-mono text-xs" : "text-muted-foreground"}
        >
          {value}
        </TableCell>
      ))}
    </TableRow>
  );
}
