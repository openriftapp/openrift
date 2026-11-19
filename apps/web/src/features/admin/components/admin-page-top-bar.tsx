import type { ReactNode } from "react";

import { PageTopBar, PageTopBarActions, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { TopBarSlotPortal } from "@/components/layout/top-bar-slot";
import { useSidebar } from "@/components/ui/sidebar";

interface AdminPageTopBarProps {
  title: ReactNode;
  back?: ReactNode;
  actions?: ReactNode;
}

/**
 * Per-page sticky top bar for admin pages. Portals a {@link PageTopBar} with
 * the page title (sidebar toggle on mobile) and optional actions into the
 * admin layout's sticky slot. Render it once at the top of every admin page.
 */
export function AdminPageTopBar({ title, back, actions }: AdminPageTopBarProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <TopBarSlotPortal>
      <PageTopBar>
        {back}
        <PageTopBarTitle onToggleSidebar={toggleSidebar}>{title}</PageTopBarTitle>
        {actions && <PageTopBarActions>{actions}</PageTopBarActions>}
      </PageTopBar>
    </TopBarSlotPortal>
  );
}
