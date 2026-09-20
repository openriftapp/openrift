import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart } from "recharts";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pager } from "@/components/ui/pager";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHAMPIONS } from "@/features/admin/components/design/demo-data";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";

const CHART_DATA = [
  { day: "Mon", value: 4.2 },
  { day: "Tue", value: 4.6 },
  { day: "Wed", value: 4.4 },
  { day: "Thu", value: 5.1 },
  { day: "Fri", value: 5.6 },
  { day: "Sat", value: 5.4 },
  { day: "Sun", value: 6 },
];

const CHART_CONFIG = {
  value: { label: "Price", color: "var(--chart-1)" },
} satisfies ChartConfig;

const GROUPS = {
  tabs: { id: "data-tabs", title: "Tabs" },
  table: { id: "data-table", title: "Table" },
  disclosure: { id: "data-disclosure", title: "Disclosure" },
  scroll: { id: "data-scroll", title: "Scroll & dividers" },
  chart: { id: "data-chart", title: "Chart" },
  pager: { id: "data-pager", title: "Pager" },
} as const;

export const DATA_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function DataSection() {
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);

  return (
    <DemoSection id="data" title="Data & layout" note="How a page arranges content it already has.">
      <DemoGroup {...GROUPS.tabs} hint="Peer views of one surface, never navigation.">
        <DemoRow label="Tabs" className="block">
          <Tabs defaultValue="cards" className="w-full max-w-md">
            <TabsList>
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>
            <TabsContent value="cards" className="text-muted-foreground text-sm">
              Tab content renders here.
            </TabsContent>
            <TabsContent value="stats" className="text-muted-foreground text-sm">
              Energy curve, domains, formats.
            </TabsContent>
          </Tabs>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.table} hint="Card browsers use the virtualized card table instead.">
        <DemoRow label="Table" className="block">
          <Table className={ADMIN_TABLE_CLASS}>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Set</TableHead>
                <TableHead className="text-right">Owned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Teemo, Swift Scout</TableCell>
                <TableCell>Origins</TableCell>
                <TableCell className="text-right tabular-nums">4</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Jinx, Loose Cannon</TableCell>
                <TableCell>Origins</TableCell>
                <TableCell className="text-right tabular-nums">2</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.disclosure}>
        <DemoGrid>
          <Demo name="Accordion" hint="Stacked disclosure list, one item open at a time.">
            <Accordion className="w-full">
              <AccordionItem value="rules">
                <AccordionTrigger>Deck rules</AccordionTrigger>
                <AccordionContent>40 cards minimum, 3 copies max.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="legends">
                <AccordionTrigger>Legends</AccordionTrigger>
                <AccordionContent>Exactly one legend per deck.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Demo>
          <Demo name="Collapsible" hint="Single hide/show region behind its own trigger.">
            <Collapsible
              open={collapsibleOpen}
              onOpenChange={setCollapsibleOpen}
              className="w-full space-y-2"
            >
              <CollapsibleTrigger
                render={
                  <Button variant="outline" size="sm">
                    {collapsibleOpen ? "Hide" : "Show"} advanced <ChevronDownIcon />
                  </Button>
                }
              />
              <CollapsibleContent className="text-muted-foreground text-sm">
                Collapsed-by-default extras live here.
              </CollapsibleContent>
            </Collapsible>
          </Demo>
        </DemoGrid>
      </DemoGroup>

      <DemoGroup {...GROUPS.scroll}>
        <DemoGrid>
          <Demo name="ScrollArea" hint="Styled scrollbars for fixed-height overflow regions.">
            <ScrollArea className="h-24 w-48 rounded-md border p-2 text-sm">
              {[...CHAMPIONS, ...CHAMPIONS].map((name, index) => (
                <p key={index} className="py-0.5">
                  {name}
                </p>
              ))}
            </ScrollArea>
          </Demo>
          <Demo
            name="Separator"
            hint="Only where the design language draws a hairline, never between sibling sections."
          >
            <div className="w-full space-y-2 text-sm">
              <p>Above</p>
              <Separator />
              <div className="flex h-5 items-center gap-2">
                <span>Left</span>
                <Separator orientation="vertical" />
                <span>Right</span>
              </div>
            </div>
          </Demo>
        </DemoGrid>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.chart}
        hint="The config drives the themed var(--color-*) each series uses."
      >
        <DemoRow label="ChartContainer" className="block">
          <ChartContainer config={CHART_CONFIG} className="aspect-auto h-16 w-full max-w-md">
            <AreaChart data={CHART_DATA} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                fill="var(--color-value)"
                fillOpacity={0.15}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ChartContainer>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.pager} hint="Server-paged lists, where a single page renders nothing.">
        <DemoRow label="Pager" className="block">
          <div className="flex flex-col gap-4">
            <PagerDemo totalPages={4} />
            <PagerDemo totalPages={42} />
          </div>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}

function PagerDemo({ totalPages }: { totalPages: number }) {
  const [page, setPage] = useState(1);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Pager page={page} totalPages={totalPages} onPageChange={setPage} label="Demo pages" />
      <p className="text-muted-foreground text-2xs font-mono">{`page ${page} of ${totalPages}`}</p>
    </div>
  );
}
