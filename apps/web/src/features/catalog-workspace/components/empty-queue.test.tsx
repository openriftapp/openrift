import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceRole } from "@/features/catalog-workspace/lib/owner-items";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/admin/workspace" className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/features/catalog-workspace/hooks/use-workspace-decisions", () => ({
  useWorkspaceDecisions: () => ({ data: [] }),
}));
vi.mock("@/features/catalog-workspace/hooks/use-register-record-actions", () => ({
  useRegisterRecordActions: vi.fn(),
}));

const { EmptyQueue } = await import("./empty-queue");

const DESK: WorkspaceRole = "desk";

describe("EmptyQueue", () => {
  it.each<WorkspaceOwner>(["card", "face", "printing"])(
    "shows the Enter hint on the %s queue's next link",
    (owner) => {
      render(
        <EmptyQueue
          owner={owner}
          segment="open"
          role={DESK}
          items={[]}
          newCount={2}
          doneToday={0}
        />,
      );

      const link = screen.getByRole("link", { name: /: 2/u });
      expect(link).toHaveTextContent("↵");
    },
  );
});
