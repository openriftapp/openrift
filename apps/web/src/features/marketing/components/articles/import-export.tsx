import { ParaglideMessage } from "@inlang/paraglide-js-react";
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
        <ParaglideMessage
          message={m.help_import_export_intro}
          markup={{
            strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            link: ({ children }) => <TextLink href="/collections">{children}</TextLink>,
          }}
        />
      </p>

      <section>
        <Heading className="mb-2">{m.help_import_export_importing_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_import_export_importing_p}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
      </section>

      <section>
        <Heading level={3} className="mb-2">
          {m.help_import_export_step1_heading()}
        </Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_import_export_step1_p}
            markup={{ code: ({ children }) => <Code>{children}</Code> }}
          />
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
          <ParaglideMessage
            message={m.help_import_export_review_p1}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>

        <p className="text-muted-foreground mt-2">
          <ParaglideMessage
            message={m.help_import_export_review_p2}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_import_export_exporting_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_import_export_export_p}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
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
              code: ({ children }) => <Code>{children}</Code>,
              em: ({ children }) => <em>{children}</em>,
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
                code: ({ children }) => <Code>{children}</Code>,
                link: ({ children }) => <TextLink href="/cards">{children}</TextLink>,
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
