import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
import { useQuery } from "@tanstack/react-query";
import { Link, useMatches } from "@tanstack/react-router";
import {
  BanIcon,
  BookOpenIcon,
  ActivityIcon,
  CalendarClockIcon,
  CameraIcon,
  ChevronRightIcon,
  GaugeIcon,
  SquareDashedIcon,
  CloudIcon,
  CopyIcon,
  CrownIcon,
  FileWarningIcon,
  GalleryVerticalIcon,
  DatabaseIcon,
  FlagIcon,
  GlobeIcon,
  HashIcon,
  ImageIcon,
  InboxIcon,
  KeyRoundIcon,
  LanguagesIcon,
  LayoutDashboardIcon,
  LayoutListIcon,
  ListChecksIcon,
  PackageIcon,
  PackageSearchIcon,
  PaintbrushIcon,
  PaletteIcon,
  LayersIcon,
  ScrollTextIcon,
  SendIcon,
  ShapesIcon,
  SparklesIcon,
  SwordsIcon,
  MapIcon,
  SpellCheckIcon,
  SwatchBookIcon,
  TagIcon,
  TagsIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  NestedSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useReviewQueueWhen } from "@/features/admin/hooks/use-catalog-review";
import { adminSectionsForPathname } from "@/features/admin/lib/admin-sections";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";

const REVIEW_PATH = "/admin/review" as const;

const overviewPages = [{ to: "/admin" as const, icon: LayoutDashboardIcon, title: "Dashboard" }];

const workspacePages = [
  { to: "/admin/workspace/cards" as const, icon: GalleryVerticalIcon, title: "Cards" },
  { to: "/admin/workspace/printings" as const, icon: LayersIcon, title: "Printings" },
  { to: "/admin/workspace/faces" as const, icon: CopyIcon, title: "Faces" },
];

const WORKSPACE_OWNERS: Partial<Record<string, WorkspaceOwner>> = {
  "/admin/workspace/cards": "card",
  "/admin/workspace/printings": "printing",
  "/admin/workspace/faces": "face",
};

const catalogPages = [
  { to: REVIEW_PATH, icon: InboxIcon, title: "Review" },
  { to: "/admin/sets" as const, icon: DatabaseIcon, title: "Sets" },
  { to: "/admin/cards" as const, icon: GalleryVerticalIcon, title: "Cards" },
  { to: "/admin/sources" as const, icon: DatabaseIcon, title: "Sources" },
  { to: "/admin/images" as const, icon: ImageIcon, title: "Images" },
  { to: "/admin/ignored-sources" as const, icon: BanIcon, title: "Review Decisions" },
  { to: "/admin/printing-desk" as const, icon: CameraIcon, title: "Printing Desk" },
];

const taxonomyPages = [
  { to: "/admin/markers" as const, icon: TagIcon, title: "Markers" },
  { to: "/admin/card-tags" as const, icon: TagsIcon, title: "Card Tags" },
  { to: "/admin/custom-tags" as const, icon: TagIcon, title: "Custom Tags" },
  { to: "/admin/distribution-channels" as const, icon: MapIcon, title: "Distribution Channels" },
  { to: "/admin/domains" as const, icon: PaletteIcon, title: "Domains" },
  { to: "/admin/card-types" as const, icon: ShapesIcon, title: "Card Types" },
  { to: "/admin/super-types" as const, icon: CrownIcon, title: "Supertypes" },
  { to: "/admin/deck-zones" as const, icon: LayoutListIcon, title: "Deck Zones" },
  { to: "/admin/deck-formats" as const, icon: SwordsIcon, title: "Deck Formats" },
  { to: "/admin/rarities" as const, icon: SparklesIcon, title: "Rarities" },
  { to: "/admin/finishes" as const, icon: PaintbrushIcon, title: "Finishes" },
  { to: "/admin/art-variants" as const, icon: ImageIcon, title: "Art Variants" },
  { to: "/admin/languages" as const, icon: LanguagesIcon, title: "Languages" },
  { to: "/admin/keywords" as const, icon: HashIcon, title: "Keywords" },
];

const contentPages = [
  { to: "/admin/rules" as const, icon: BookOpenIcon, title: "Rules" },
  { to: "/admin/errata" as const, icon: FileWarningIcon, title: "Errata" },
  { to: "/admin/meta" as const, icon: TrophyIcon, title: "Meta Archive" },
  { to: "/admin/board-states" as const, icon: ShapesIcon, title: "Board States" },
];

const marketplacePages = [
  { to: "/admin/marketplace-overview" as const, icon: LayoutDashboardIcon, title: "Overview" },
  { to: "/admin/marketplace-groups" as const, icon: LayersIcon, title: "Groups" },
  { to: "/admin/products" as const, icon: PackageIcon, title: "Products" },
  { to: "/admin/unmatched" as const, icon: PackageSearchIcon, title: "Unmatched products" },
  { to: "/admin/ignored-products" as const, icon: BanIcon, title: "Ignored Products" },
];

const operationsPages = [
  { to: "/admin/status" as const, icon: ActivityIcon, title: "Status" },
  { to: "/admin/jobs" as const, icon: CalendarClockIcon, title: "Jobs" },
  { to: "/admin/job-runs" as const, icon: ListChecksIcon, title: "Job Runs" },
  { to: "/admin/printing-events" as const, icon: SendIcon, title: "Printing Events" },
  { to: "/admin/audit" as const, icon: ScrollTextIcon, title: "Audit Log" },
  { to: "/admin/cache" as const, icon: CloudIcon, title: "Cache" },
];

const peoplePages = [
  { to: "/admin/users" as const, icon: UsersIcon, title: "Users" },
  { to: "/admin/organizations" as const, icon: CrownIcon, title: "Organizations" },
  { to: "/admin/group-banners" as const, icon: ImageIcon, title: "Group Banners" },
  { to: "/admin/api-keys" as const, icon: KeyRoundIcon, title: "API Keys" },
];

const configPages = [
  { to: "/admin/feature-flags" as const, icon: FlagIcon, title: "Feature Flags" },
  { to: "/admin/site-settings" as const, icon: GlobeIcon, title: "Site Settings" },
];

const devToolPages = [
  { to: "/admin/design" as const, icon: SwatchBookIcon, title: "Design" },
  { to: "/admin/typography-review" as const, icon: SpellCheckIcon, title: "Typography" },
  { to: "/admin/scan" as const, icon: CameraIcon, title: "Scan Test" },
  ...(import.meta.env.DEV
    ? [
        { to: "/admin/scan-bench" as const, icon: GaugeIcon, title: "Scan Bench" },
        { to: "/admin/outline-labels" as const, icon: SquareDashedIcon, title: "Outline Labels" },
      ]
    : []),
];

const sharedGroups = [
  { label: "Marketplaces", pages: marketplacePages },
  { label: "Content", pages: contentPages },
  { label: "Taxonomy", pages: taxonomyPages, collapsible: true },
  { label: "Operations", pages: operationsPages },
  { label: "People", pages: peoplePages },
  { label: "Config", pages: configPages },
  { label: "Dev Tools", pages: devToolPages, collapsible: true },
];

const groups = [
  { label: "Overview", pages: overviewPages },
  { label: "Catalog", pages: catalogPages },
  ...sharedGroups,
];

const workspaceGroups = [
  { label: "Overview", pages: overviewPages },
  { label: "Workspace", pages: workspacePages },
  { label: "Catalog", pages: catalogPages },
  ...sharedGroups,
];

// The dashboard is an index route, so its match reports "/admin/" while the link is "/admin".
function isCurrent(currentPath: string | undefined, to: string): boolean {
  if (currentPath === to || currentPath === `${to}/`) {
    return true;
  }
  return WORKSPACE_OWNERS[to] !== undefined && currentPath?.startsWith(`${to}/`) === true;
}

export function AdminSidebar() {
  const matches = useMatches();
  const currentPath = matches.at(-1)?.fullPath;
  const { data: access } = useAdminAccess();
  const workspaceEnabled = useFeatureEnabled("catalog-workspace");

  // Partial admins (per-section grants, no full admin role) only see the
  // sections they hold; groups left empty disappear entirely.
  const isAdmin = access?.isAdmin === true;
  const sections = access?.sections ?? [];
  const canReview = isAdmin || sections.includes("card-review");
  const { data: reviewQueue } = useReviewQueueWhen(canReview);
  const { data: workspaceQueue } = useQuery({
    ...workspaceQueueQueryOptions(),
    enabled: workspaceEnabled && canReview,
  });
  const openReviews = reviewQueue?.counts.open ?? 0;
  const ownerCount = (to: string) => {
    const owner = WORKSPACE_OWNERS[to];
    if (owner === undefined || workspaceQueue === undefined) {
      return 0;
    }
    return workspaceQueue.counts[owner].open + workspaceQueue.counts[owner].new;
  };
  const [openGroups, setOpenGroups] = useState<Partial<Record<string, boolean>>>({});
  const visibleGroups = (workspaceEnabled ? workspaceGroups : groups)
    .map((group) => ({
      ...group,
      collapsible: "collapsible" in group && group.collapsible,
      pages: isAdmin
        ? group.pages
        : group.pages.filter((page) =>
            adminSectionsForPathname(page.to).some((section) => sections.includes(section)),
          ),
    }))
    .filter((group) => group.pages.length > 0);

  return (
    <NestedSidebar className="ml-safe">
      <SidebarContent>
        {visibleGroups.map((group) => {
          const menu = (
            <SidebarMenu className="gap-1">
              {group.pages.map((page) => (
                <SidebarMenuItem key={page.to}>
                  <SidebarMenuButton
                    isActive={isCurrent(currentPath, page.to)}
                    render={<Link to={page.to} />}
                  >
                    <page.icon />
                    <span>{page.title}</span>
                    {page.to === REVIEW_PATH && openReviews > 0 && (
                      <Badge variant="count" className="ml-auto">
                        {openReviews}
                      </Badge>
                    )}
                    {ownerCount(page.to) > 0 && (
                      <Badge variant="count" className="ml-auto">
                        {ownerCount(page.to)}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          );
          if (!group.collapsible) {
            return (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                {menu}
              </SidebarGroup>
            );
          }
          const open =
            openGroups[group.label] ?? group.pages.some((page) => isCurrent(currentPath, page.to));
          return (
            <Collapsible
              key={group.label}
              open={open}
              onOpenChange={(next) => setOpenGroups((prev) => ({ ...prev, [group.label]: next }))}
            >
              <SidebarGroup>
                <SidebarGroupLabel
                  className="group hover:bg-sidebar-accent cursor-pointer gap-1.5 transition-colors"
                  render={<CollapsibleTrigger />}
                >
                  <ChevronRightIcon className="size-3! transition-transform group-data-[panel-open]:rotate-90" />
                  <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                </SidebarGroupLabel>
                <CollapsibleContent className="overflow-hidden transition-[height] duration-200 data-[ending-style]:h-0 data-[starting-style]:h-0">
                  {menu}
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </NestedSidebar>
  );
}
