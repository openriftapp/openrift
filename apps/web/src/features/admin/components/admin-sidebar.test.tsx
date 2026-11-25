import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  workspaceEnabled: false,
  queueEnabled: [] as boolean[],
}));

function Passthrough({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
  useMatches: () => [{ fullPath: "/admin" }],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ enabled }: { enabled: boolean }) => ({
    data: enabled ? { cards: [{}, {}, {}] } : undefined,
  }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  NestedSidebar: Passthrough,
  SidebarContent: Passthrough,
  SidebarGroup: Passthrough,
  SidebarGroupLabel: Passthrough,
  SidebarMenu: Passthrough,
  SidebarMenuItem: Passthrough,
  SidebarMenuButton: Passthrough,
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: Passthrough,
  CollapsibleContent: Passthrough,
  CollapsibleTrigger: Passthrough,
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true, sections: [] } }),
}));

vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useReviewQueueWhen: (enabled: boolean) => {
    state.queueEnabled.push(enabled);
    return { data: enabled ? { counts: { open: 7 } } : undefined };
  },
}));

vi.mock("@/features/catalog-workspace/lib/review-cards", () => ({
  reviewCardsQueryOptions: () => ({ queryKey: ["review-cards"] }),
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureEnabled: () => state.workspaceEnabled,
}));

const { AdminSidebar } = await import("./admin-sidebar");

beforeEach(() => {
  state.queueEnabled = [];
});

describe("AdminSidebar review counts", () => {
  it("shows the old review queue's count without the workspace", () => {
    state.workspaceEnabled = false;
    render(<AdminSidebar />);

    expect(state.queueEnabled.every(Boolean)).toBe(true);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("3")).toBeNull();
  });

  it("shows only the workspace count and skips the old queue with the workspace on", () => {
    state.workspaceEnabled = true;
    render(<AdminSidebar />);

    expect(state.queueEnabled.length).toBeGreaterThan(0);
    expect(state.queueEnabled.some(Boolean)).toBe(false);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("7")).toBeNull();
  });
});
