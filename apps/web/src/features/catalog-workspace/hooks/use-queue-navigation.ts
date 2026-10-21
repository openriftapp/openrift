import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
import { useNavigate, useParams } from "@tanstack/react-router";

import { useWorkspaceEntries } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import type {
  ListEntry,
  WorkspaceRouteParams,
  WorkspaceTarget,
} from "@/features/catalog-workspace/lib/owner-items";
import { selectedKeyFromParams, stepIndex } from "@/features/catalog-workspace/lib/owner-items";
import { useWorkspaceSkipStore } from "@/features/catalog-workspace/stores/workspace-skip-store";

type Navigate = ReturnType<typeof useNavigate>;

export function navigateToTarget(
  navigate: Navigate,
  owner: WorkspaceOwner,
  target: WorkspaceTarget | null,
): void {
  switch (target?.kind) {
    case "card": {
      void navigate({
        to: "/admin/workspace/cards/$cardSlug",
        params: { cardSlug: target.cardSlug },
        search: true,
      });
      return;
    }
    case "card-new": {
      void navigate({
        to: "/admin/workspace/cards/new/$name",
        params: { name: target.name },
        search: true,
      });
      return;
    }
    case "face": {
      void navigate({
        to: "/admin/workspace/faces/$cardSlug/$faceId",
        params: { cardSlug: target.cardSlug, faceId: target.faceId },
        search: true,
      });
      return;
    }
    case "printing": {
      void navigate({
        to: "/admin/workspace/printings/$printingId",
        params: { printingId: target.printingId },
        search: true,
      });
      return;
    }
    case "printing-new": {
      void navigate({
        to: "/admin/workspace/printings/new/$candidatePrintingId",
        params: { candidatePrintingId: target.candidatePrintingId },
        search: true,
      });
      return;
    }
    case undefined: {
      navigateToOwnerList(navigate, owner);
    }
  }
}

function navigateToOwnerList(navigate: Navigate, owner: WorkspaceOwner): void {
  if (owner === "card") {
    void navigate({ to: "/admin/workspace/cards", search: true });
  } else if (owner === "face") {
    void navigate({ to: "/admin/workspace/faces", search: true });
  } else {
    void navigate({ to: "/admin/workspace/printings", search: true });
  }
}

export function planQueueStep(
  entries: readonly ListEntry[],
  currentKey: string | null,
  delta: 1 | -1,
): { kind: "go"; target: WorkspaceTarget } | { kind: "list" } | { kind: "stay" } {
  const linkable = entries.filter((entry) => entry.target !== null);
  const index = linkable.findIndex((entry) => entry.key === currentKey);
  const next = stepIndex(linkable.length, index, delta);
  const entry = next === null ? undefined : linkable[next];
  if (entry?.target && entry.key !== currentKey) {
    return { kind: "go", target: entry.target };
  }
  return delta > 0 && currentKey !== null ? { kind: "list" } : { kind: "stay" };
}

export function useQueueNavigation(owner: WorkspaceOwner): {
  goNext: () => void;
  goPrev: () => void;
  skipToEnd: () => void;
  position: { index: number; total: number } | null;
} {
  const navigate = useNavigate();
  const params: WorkspaceRouteParams = useParams({ strict: false });
  const { view, listAllowed, entries } = useWorkspaceEntries(owner);
  const skip = useWorkspaceSkipStore((state) => state.skip);

  const currentKey = selectedKeyFromParams(params);
  const linkable = entries.filter((entry) => entry.target !== null);
  const index = linkable.findIndex((entry) => entry.key === currentKey);

  function step(delta: 1 | -1) {
    if (!listAllowed) {
      return;
    }
    const plan = planQueueStep(entries, currentKey, delta);
    if (plan.kind === "go") {
      navigateToTarget(navigate, owner, plan.target);
    } else if (plan.kind === "list") {
      navigateToOwnerList(navigate, owner);
    }
  }

  return {
    goNext: () => step(1),
    goPrev: () => step(-1),
    skipToEnd: () => {
      if (currentKey === null || view === "all" || index === -1 || linkable.length < 2) {
        return;
      }
      skip(owner, currentKey);
      step(1);
    },
    position: index === -1 ? null : { index, total: linkable.length },
  };
}
