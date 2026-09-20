import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { usePageTopBarHeight } from "@/components/layout/page-top-bar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminFilterSwitch } from "@/features/admin/components/admin-filters";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import {
  DesignSpecsProvider,
  useDesignSpecs,
} from "@/features/admin/components/design/design-specs";
import { PAGE_WIDTH, cn } from "@/lib/utils";

const DESIGN_TABS = [
  { to: "/admin/design", label: "Foundations" },
  { to: "/admin/design/components", label: "Components" },
  { to: "/admin/design/patterns", label: "Patterns" },
] as const;

type DesignTabPath = (typeof DESIGN_TABS)[number]["to"];

function activeTab(pathname: string): DesignTabPath {
  if (pathname.startsWith("/admin/design/components")) {
    return "/admin/design/components";
  }
  if (pathname.startsWith("/admin/design/patterns")) {
    return "/admin/design/patterns";
  }
  return "/admin/design";
}

function SpecsSwitch() {
  const { showSpecs, setShowSpecs } = useDesignSpecs();
  return (
    <AdminFilterSwitch id="design-specs" checked={showSpecs} onChange={setShowSpecs}>
      Specs
    </AdminFilterSwitch>
  );
}

function DesignTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  return (
    <Tabs
      value={activeTab(pathname)}
      onValueChange={(value) => {
        const tab = DESIGN_TABS.find((entry) => entry.to === value);
        if (tab) {
          void navigate({ to: tab.to });
        }
      }}
    >
      <TabsList variant="line">
        {DESIGN_TABS.map((tab) => (
          <TabsTrigger key={tab.to} value={tab.to} render={<Link to={tab.to} />}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function DesignLayout() {
  const topBarHeight = usePageTopBarHeight();

  return (
    <DesignSpecsProvider>
      <TooltipProvider>
        <div
          className={cn(PAGE_WIDTH.full, "flex flex-col gap-6 pb-16")}
          style={
            {
              "--sticky-top": `calc(var(--header-height) + ${topBarHeight}px + 1rem)`,
            } as CSSProperties
          }
        >
          <AdminPageTopBar title="Design" actions={<SpecsSwitch />} />
          <DesignTabs />
          <Outlet />
        </div>
      </TooltipProvider>
    </DesignSpecsProvider>
  );
}
