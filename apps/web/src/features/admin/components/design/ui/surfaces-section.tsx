import { Link } from "@tanstack/react-router";
import {
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  FolderIcon,
  GlobeIcon,
  HeartIcon,
  PackageIcon,
  TrophyIcon,
  UserPlusIcon,
  UsersIcon,
  ZapIcon,
  XIcon,
} from "lucide-react";

import { CoverBand } from "@/components/cover-band";
import { Heading } from "@/components/heading";
import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsSection } from "@/components/layout/settings-section";
import { ActionBand } from "@/components/ui/action-band";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { CardList, CardListRow, CardRow } from "@/components/ui/card-list";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RowList, RowListItem, RowListLink } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatStrip } from "@/components/ui/stat-strip";
import { StatTile } from "@/components/ui/stat-tile";
import { Switch } from "@/components/ui/switch";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { cn } from "@/lib/utils";

const GROUPS = {
  card: { id: "surfaces-card", title: "Card" },
  cardLink: { id: "surfaces-card-link", title: "Card link" },
  cardList: { id: "surfaces-card-list", title: "Card list & rows" },
  rowList: { id: "surfaces-row-list", title: "Row list" },
  settings: { id: "surfaces-settings", title: "Settings sections" },
  definitionList: { id: "surfaces-definition-list", title: "Definition list" },
  stat: { id: "surfaces-stat", title: "Stats" },
  actionBand: { id: "surfaces-action-band", title: "Action band" },
} as const;

export const SURFACES_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function SurfacesSection() {
  return (
    <DemoSection
      id="surfaces"
      title="Surfaces & lists"
      note="The containers content sits in, boxed and flat."
      docs="docs/design-language.md → When not to box"
    >
      <DemoGroup
        {...GROUPS.card}
        hint="A box means an entity, a popup or a destructive boundary, and nothing else."
      >
        <DemoRow label="Card">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Summoner Skirmish</CardTitle>
              <CardDescription>Saturday · 12 entrants</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">Swiss, 4 rounds, then a cut to top 4.</CardContent>
            <CardFooter>
              <Button size="sm" variant="outline">
                Manage
              </Button>
            </CardFooter>
          </Card>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.cardLink}
        hint="The whole-Card click target for list tiles, hovering with a shadow lift, a muted wash and a 1px primary edge."
      >
        <DemoRow label="Row">
          <CardLink
            render={<Link to="/admin/design/components" hash="surfaces-card-link" />}
            className="w-full max-w-sm flex-row items-center gap-3 p-3"
          >
            <PackageIcon className="text-muted-foreground size-5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">Jinx&apos;s Arsenal</span>
              <span className="text-muted-foreground text-xs">Tradelist · 24 Cards</span>
            </div>
            <Badge variant="secondary">Shared</Badge>
          </CardLink>
        </DemoRow>
        <DemoRow label="Image-dominated">
          <CardLink
            render={<Link to="/admin/design/components" hash="surfaces-card-link" />}
            className="w-full max-w-sm gap-0 py-0"
          >
            <div className="bg-muted flex h-24 items-center justify-center rounded-t-lg">
              <PackageIcon className="text-muted-foreground size-8" />
            </div>
            <div className="flex flex-col p-3">
              <span className="font-medium">Piltover Starter</span>
              <span className="text-muted-foreground text-xs">Ready to play</span>
            </div>
          </CardLink>
        </DemoRow>
        <DemoRow label="Cover band">
          <CardLink
            render={<Link to="/admin/design/components" hash="surfaces-card-link" />}
            className="w-full max-w-sm flex-col gap-0 py-0"
          >
            <CoverBand aria-hidden="true" className="flex h-28 items-center justify-center">
              <TrophyIcon className="text-muted-foreground size-10" />
            </CoverBand>
            <div className="flex min-w-0 flex-col gap-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Heading className="min-w-0 truncate">Tuesday Night Crew</Heading>
                <Badge>Owner</Badge>
              </div>
              <p className="text-muted-foreground mt-auto pt-1 text-sm tabular-nums">
                8 members
                <span className="mx-1.5 opacity-60">·</span>
                12 shared lists
              </p>
            </div>
          </CardLink>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.cardList}
        hint="CardList and CardRow are alternatives, not a pair: a CardRow never goes inside a CardList."
      >
        <DemoRow label="CardList / CardRow" className="items-start gap-6">
          <CardList className="w-full max-w-xs">
            {["Round 1", "Round 2", "Round 3"].map((round) => (
              <li
                key={round}
                className="hover:bg-muted/50 flex items-center gap-2.5 rounded-md px-2 py-2"
              >
                <span className="bg-primary/60 size-2 shrink-0 rounded-full" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{round}</span>
                <span className="text-muted-foreground shrink-0 text-xs">finalized</span>
              </li>
            ))}
          </CardList>
          <ul className="flex w-full max-w-xs flex-col gap-1.5">
            {["Vi", "Ekko"].map((name) => (
              <CardRow key={name}>
                <span className="min-w-0 truncate font-medium">{name}</span>
                <span className="font-semibold tabular-nums">+3 bye</span>
              </CardRow>
            ))}
          </ul>
        </DemoRow>
        <DemoRow label="CardListRow" hint="The middle row below is painted in its hover state.">
          <CardList className="w-full max-w-sm">
            {[
              { name: "Jinx, Loose Cannon", meta: "OGN-042 · Origins", hovered: false },
              { name: "Vi, Enforcer", meta: "OGN-118 · Origins", hovered: true },
              { name: "Ekko, Time Winder", meta: "OGN-077 · Origins", hovered: false },
            ].map((row) => (
              <li key={row.name}>
                <CardListRow
                  render={<Link to="/admin/design/components" hash="surfaces-card-list" />}
                  className={cn(row.hovered && "bg-muted/50")}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{row.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{row.meta}</span>
                  </span>
                  <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
                </CardListRow>
              </li>
            ))}
          </CardList>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.rowList}
        hint="Rows separate by spacing and, when clickable, by the hover wash. variant divided adds hairlines for tall multi-line rows only."
      >
        <DemoRow label="SectionHeading + RowList" className="block">
          <div className="max-w-md space-y-2">
            <SectionHeading count={3}>Rounds</SectionHeading>
            <RowList>
              <RowListItem>
                <RowListLink
                  render={<Link to="/admin/design/components" hash="surfaces-row-list" />}
                >
                  <TrophyIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="flex-1 truncate">Round 1</span>
                  <span className="text-muted-foreground text-xs">8 tables</span>
                  <ChevronRightIcon className="text-muted-foreground/40 size-4" />
                </RowListLink>
              </RowListItem>
              <RowListItem>
                <RowListLink
                  render={<Link to="/admin/design/components" hash="surfaces-row-list" />}
                >
                  <TrophyIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="flex-1 truncate">Round 2</span>
                  <span className="text-muted-foreground text-xs">8 tables</span>
                  <ChevronRightIcon className="text-muted-foreground/40 size-4" />
                </RowListLink>
              </RowListItem>
              <RowListItem>
                <UsersIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="flex-1 truncate">Top cut</span>
                <Badge variant="outline">Not paired</Badge>
              </RowListItem>
            </RowList>
          </div>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.settings}
        hint="SettingsGroup stacks its sections by spacing under a labelled ornament rule, with no hairlines between them."
      >
        <DemoRow label="SettingsGroup + SettingsSection" className="block">
          <div className="max-w-xl">
            <SettingsGroup id="demo-flat-settings" title="Tournament">
              <SettingsSection
                title="Name"
                description="The tournament's display name."
                contentClassName="flex-row gap-2"
              >
                <Input
                  defaultValue="Summoner Skirmish"
                  aria-label="Tournament name"
                  className="max-w-xs"
                />
                <Button>Save</Button>
              </SettingsSection>
              <SettingsSection
                title="Follow-along"
                description="Let players see pairings and standings as rounds go live."
                action={<Badge variant="secondary">Live</Badge>}
              >
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="demo-follow">Publish standings</Label>
                  <Switch id="demo-follow" defaultChecked />
                </div>
              </SettingsSection>
            </SettingsGroup>
          </div>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.definitionList}>
        <DemoRow label="DefinitionList" className="block">
          <DefinitionList className="max-w-md">
            <DefinitionTerm>Set</DefinitionTerm>
            <DefinitionDetail>Origins</DefinitionDetail>
            <DefinitionTerm>Rarity</DefinitionTerm>
            <DefinitionDetail>Epic</DefinitionDetail>
            <DefinitionTerm>Artist</DefinitionTerm>
            <DefinitionDetail>Sixmorevodka</DefinitionDetail>
          </DefinitionList>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.stat}>
        <DemoRow label="StatTile" className="block">
          <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            <StatTile
              render={<Link to="/admin/design/components" hash="surfaces-stat" />}
              icon={HeartIcon}
              label="Wishlists"
              value={4}
              hint="2 shared with your group"
            />
            <StatTile
              render={<Link to="/admin/design/components" hash="surfaces-stat" />}
              icon={BellIcon}
              label="Requests"
              value={3}
              accent
              hint="3 requests to review"
            />
          </div>
        </DemoRow>
        <DemoRow
          label="StatTile tones"
          hint="tone tints the icon chip only, and accent overrides tone."
          className="block"
        >
          <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              render={<Link to="/admin/design/components" hash="surfaces-stat" />}
              icon={ZapIcon}
              label="Trades"
              value={4}
              tone="gold"
              hint="tone=gold"
            />
            <StatTile
              render={<Link to="/admin/design/components" hash="surfaces-stat" />}
              icon={FolderIcon}
              label="Collections"
              value={1}
              tone="info"
              hint="tone=info"
            />
            <StatTile
              render={<Link to="/admin/design/components" hash="surfaces-stat" />}
              icon={UsersIcon}
              label="Members"
              value={9}
              tone="success"
              hint="tone=success"
            />
            <StatTile
              render={<Link to="/admin/design/components" hash="surfaces-stat" />}
              icon={TrophyIcon}
              label="Tournaments"
              value={2}
              tone="violet"
              hint="tone=violet"
            />
          </div>
        </DemoRow>
        <DemoRow
          label="StatStrip"
          hint="Nothing here links, so reach for StatTile when the number should take you somewhere."
          className="flex-col items-stretch"
        >
          <StatStrip
            items={[
              { key: "active", value: 11, label: "active", icon: CheckIcon, iconTone: "success" },
              { key: "dropped", value: 3, label: "dropped", icon: UsersIcon },
              { key: "regions", value: 4, label: "regions", icon: GlobeIcon, iconTone: "info" },
            ]}
          />
          <StatStrip
            items={[
              { key: "penalty", value: 12, label: "penalty" },
              { key: "rematches", value: 0, label: "rematches", tone: "good" },
              { key: "three", value: 3, label: "in 3-pods" },
              { key: "spread", value: 4, label: "largest spread" },
            ]}
          />
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.actionBand}
        hint="accent marks the band waiting on the viewer, and an overview page carries at most one."
      >
        <DemoRow label="ActionBand" className="block">
          <div className="flex w-full max-w-2xl flex-col gap-3">
            <ActionBand
              render={<Link to="/admin/design/components" hash="surfaces-action-band" />}
              icon={ZapIcon}
              accent
              label="Trades"
              value={3}
              sub="trades need your action"
              action={
                <span className={cn(buttonVariants(), "group-hover/action-band:bg-primary/90")}>
                  View trades
                  <ChevronRightIcon className="size-4 transition-transform group-hover/action-band:translate-x-0.5" />
                </span>
              }
            />
            <ActionBand
              render={<Link to="/admin/design/components" hash="surfaces-action-band" />}
              icon={ZapIcon}
              tone="success"
              label="Trades"
              value="Nothing waiting on you"
              valueClassName="font-sans truncate text-base font-medium"
              action={
                <span className={cn(buttonVariants({ variant: "ghost" }))}>
                  View trades
                  <ChevronRightIcon className="size-4 transition-transform group-hover/action-band:translate-x-0.5" />
                </span>
              }
            />
            <ActionBand
              icon={UserPlusIcon}
              accent
              label="Requests"
              value={1}
              sub="person waiting to join"
            >
              <Callout variant="inset" className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">Powder Undercity</span>
                  <span className="text-muted-foreground"> · requested 2h ago</span>
                </span>
                <Button size="sm">
                  <CheckIcon className="size-4" />
                  Approve
                </Button>
                <Button size="sm" variant="ghost">
                  <XIcon className="size-4" />
                  Deny
                </Button>
              </Callout>
            </ActionBand>
          </div>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
