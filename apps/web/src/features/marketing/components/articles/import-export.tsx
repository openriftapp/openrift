import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FileUpIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";

import { Eyebrow, Heading } from "@/components/heading";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code } from "@/components/ui/code";
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
import { SOCIAL_LINKS } from "@/lib/social-links";
import { m } from "@/paraglide/messages.js";

export default function ImportExportArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        {m.help_import_export_intro_before()}{" "}
        <strong className="text-foreground">{m.help_import_export_intro_import_label()}</strong>{" "}
        {m.help_import_export_intro_mid1()}{" "}
        <strong className="text-foreground">{m.help_import_export_intro_export_label()}</strong>{" "}
        {m.help_import_export_intro_mid2()}{" "}
        <strong className="text-foreground">{m.help_import_export_intro_import_nav()}</strong>{" "}
        {m.help_import_export_intro_mid3()}{" "}
        <TextLink href="/collections">{m.help_import_export_intro_collection_link()}</TextLink>{" "}
        {m.help_import_export_intro_after()}
      </p>

      <section>
        <Heading className="mb-2">{m.help_import_export_importing_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_import_export_importing_p_before()}{" "}
          <strong className="text-foreground">
            {m.help_import_export_importing_paste_label()}
          </strong>{" "}
          {m.help_import_export_importing_p_mid()}{" "}
          <strong className="text-foreground">
            {m.help_import_export_importing_review_label()}
          </strong>{" "}
          {m.help_import_export_importing_p_after()}
        </p>
      </section>

      <section>
        <Heading level={3} className="mb-2">
          {m.help_import_export_step1_heading()}
        </Heading>
        <p className="text-muted-foreground">
          {m.help_import_export_step1_p_before()} <Code>.csv</Code>{" "}
          {m.help_import_export_step1_p_after()}
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
          {m.help_import_export_other_tools_before()}{" "}
          <TextLink href={SOCIAL_LINKS.discordInvite} target="_blank" rel="noreferrer">
            Discord
          </TextLink>{" "}
          {m.help_import_export_other_tools_mid()}{" "}
          <TextLink href={SOCIAL_LINKS.githubIssues} target="_blank" rel="noreferrer">
            GitHub
          </TextLink>{" "}
          {m.help_import_export_other_tools_after()}
        </p>
      </section>

      <section>
        <Heading level={3} className="mb-2">
          {m.help_import_export_step2_heading()}
        </Heading>
        <p className="text-muted-foreground">{m.help_import_export_step2_p()}</p>

        <DefinitionList className="text-muted-foreground mt-3">
          <DefinitionTerm icon={<CheckCircle2Icon className="text-success size-4" />}>
            {m.help_import_export_status_exact()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_import_export_status_exact_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<AlertTriangleIcon className="text-warning size-4" />}>
            {m.help_import_export_status_review()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_import_export_status_review_detail()}</DefinitionDetail>
          <DefinitionTerm icon={<XCircleIcon className="text-destructive size-4" />}>
            {m.help_import_export_status_unresolved()}
          </DefinitionTerm>
          <DefinitionDetail>{m.help_import_export_status_unresolved_detail()}</DefinitionDetail>
        </DefinitionList>

        <Callout className="mt-4">
          <Eyebrow>{m.help_import_export_example_preview()}</Eyebrow>
          <div className="divide-border divide-y text-sm">
            <MockMatchRow status="exact" quantity={3} code="OGN-007" name="Fury Rune" tags={[]} />
            <MockMatchRow
              status="needs-review"
              quantity={1}
              code="OGN-001"
              name="Blazing Scorcher"
              tags={["Foil"]}
              dropdown="OGN-001 · Foil · Nexus Night"
            />
            <MockMatchRow
              status="unresolved"
              quantity={1}
              code="XXX-999"
              name="Unknown Card"
              tags={[]}
            />
          </div>
        </Callout>

        <p className="text-muted-foreground mt-3">
          {m.help_import_export_review_p1_before()}{" "}
          <strong className="text-foreground">{m.help_import_export_review_skip_label()}</strong>{" "}
          {m.help_import_export_review_p1_mid_v2()}{" "}
          <strong className="text-foreground">{m.help_import_export_review_unskip_label()}</strong>{" "}
          {m.help_import_export_review_p1_after_v2()}
        </p>

        <p className="text-muted-foreground mt-2">
          {m.help_import_export_review_p2_before()}{" "}
          <strong className="text-foreground">{m.help_import_export_import_button()}</strong>
          {m.help_import_export_review_p2_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_import_export_exporting_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_import_export_export_p_before()}{" "}
          <strong className="text-foreground">{m.help_import_export_intro_export_label()}</strong>{" "}
          {m.help_import_export_export_p_mid1()}{" "}
          <strong className="text-foreground">{m.help_import_export_all_cards_label()}</strong>
          {m.help_import_export_export_p_mid2()}{" "}
          <strong className="text-foreground">{m.help_import_export_export_button()}</strong>
          {m.help_import_export_export_p_mid3()}{" "}
          <strong className="text-foreground">{m.help_import_export_openrift_csv_label()}</strong>{" "}
          {m.help_import_export_export_p_mid4()}{" "}
          <strong className="text-foreground">Piltover Archive</strong>,{" "}
          <strong className="text-foreground">RiftMana</strong>
          {m.help_import_export_export_p_mid6()}{" "}
          <strong className="text-foreground">RiftCore</strong>{" "}
          {m.help_import_export_export_p_after()}
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
          {m.help_import_export_file_p_before()}{" "}
          <Code>
            openrift-<em>{m.help_import_export_file_collection()}</em>-
            <em>{m.help_import_export_file_date()}</em>.csv
          </Code>{" "}
          {m.help_import_export_file_p_mid()} <Code>piltover-…</Code>, <Code>riftmana-…</Code>,{" "}
          <Code>riftcore-…</Code> {m.help_import_export_file_p_after()}
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
            {m.help_import_export_matching_code_before()} <Code>OGN-007</Code>
            {m.help_import_export_matching_code_mid()}{" "}
            <TextLink href="/cards">{m.help_import_export_matching_catalog_link()}</TextLink>
            {m.help_import_export_matching_code_after()}
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

const STATUS_ICONS: Record<string, { icon: React.ReactNode; className: string }> = {
  exact: {
    icon: <CheckCircle2Icon className="size-3.5" />,
    className: "text-success",
  },
  "needs-review": {
    icon: <AlertTriangleIcon className="size-3.5" />,
    className: "text-warning",
  },
  unresolved: {
    icon: <XCircleIcon className="size-3.5" />,
    className: "text-destructive",
  },
};

function MockMatchRow({
  status,
  quantity,
  code,
  name,
  tags,
  dropdown,
}: {
  status: string;
  quantity: number;
  code: string;
  name: string;
  tags: string[];
  dropdown?: string;
}) {
  const config = STATUS_ICONS[status];

  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <span className={config?.className}>{config?.icon}</span>
      <span className="text-muted-foreground w-6 text-right text-xs tabular-nums">
        {quantity}&times;
      </span>
      <code className="bg-muted text-2xs rounded-md px-1 py-0.5">{code}</code>
      <span className="min-w-0 flex-1 truncate text-xs">{name}</span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-primary/10 text-primary text-2xs rounded-md px-1.5 py-0.5 font-medium"
        >
          {tag}
        </span>
      ))}
      {dropdown && (
        <span className="bg-background text-2xs flex items-center gap-1 rounded-md border px-1.5 py-0.5">
          {dropdown}
          <ChevronDownIcon className="text-muted-foreground size-2.5" />
        </span>
      )}
      <SearchIcon className="text-muted-foreground size-3" />
      <span className="text-muted-foreground text-2xs">{m.help_import_export_mock_skip()}</span>
    </div>
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
