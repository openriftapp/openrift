import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, TrophyIcon, UsersIcon } from "lucide-react";

import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RowList, RowListItem, RowListLink } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { Switch } from "@/components/ui/switch";

import { DemoRow, DemoSection } from "./demo-primitives";

export function FlatSectionsSection() {
  return (
    <DemoSection
      id="flat-sections"
      title="Flat sections & lists"
      note="A box means an entity, a popup or a destructive boundary. Everything else is typography and spacing. SettingsSection is the settings or form section (title, description, fields, a hairline to the next); SettingsGroup draws the hairlines. RowList is the flat list under a SectionHeading, rows separated by spacing; RowListLink gives a row the hover wash; variant divided adds hairlines for tall multi-line rows only. Callout inset is the borderless note inside another surface."
      docs="docs/design-language.md → When not to box"
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
              <Callout variant="inset">
                <p className="text-muted-foreground text-sm">
                  Standings stay hidden until the first round is paired.
                </p>
              </Callout>
            </SettingsSection>
          </SettingsGroup>
        </div>
      </DemoRow>
      <DemoRow label="SectionHeading + RowList" className="block">
        <div className="max-w-md space-y-2">
          <SectionHeading count={3}>Rounds</SectionHeading>
          <RowList>
            <RowListItem>
              <RowListLink render={<Link to="/admin/design" hash="flat-sections" />}>
                <TrophyIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="flex-1 truncate">Round 1</span>
                <span className="text-muted-foreground text-xs">8 tables</span>
                <ChevronRightIcon className="text-muted-foreground/40 size-4" />
              </RowListLink>
            </RowListItem>
            <RowListItem>
              <RowListLink render={<Link to="/admin/design" hash="flat-sections" />}>
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
    </DemoSection>
  );
}
