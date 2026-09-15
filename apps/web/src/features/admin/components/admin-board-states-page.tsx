import type { AdminBoardState } from "@openrift/shared/contracts/admin/board-states";
import { formatDayTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";

import { PageDescription } from "@/components/layout/page-top-bar";
import { Switch } from "@/components/ui/switch";
import { TextLink } from "@/components/ui/text-link";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import {
  useAdminBoardStates,
  useSetBoardStateFeatured,
} from "@/features/admin/hooks/use-admin-board-states";

function rulesLabel(row: AdminBoardState): string {
  const parts: string[] = [];
  if (row.coreRulesVersion !== null) {
    parts.push(`Core ${row.coreRulesVersion}`);
  }
  if (row.tournamentRulesVersion !== null) {
    parts.push(`Tournament ${row.tournamentRulesVersion}`);
  }
  return parts.join(" · ");
}

function TitleCell({ row }: AdminCellSlotProps<AdminBoardState>) {
  if (!row) {
    return null;
  }
  if (row.shareToken === null) {
    return <span>{row.title}</span>;
  }
  return (
    <TextLink
      className="underline"
      render={<Link to="/board/$token" params={{ token: row.shareToken }} />}
    >
      {row.title}
    </TextLink>
  );
}

function OwnerCell({ row }: AdminCellSlotProps<AdminBoardState>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{row.ownerName ?? "—"}</span>;
}

function RulesCell({ row }: AdminCellSlotProps<AdminBoardState>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{rulesLabel(row)}</span>;
}

function StepsCell({ row }: AdminCellSlotProps<AdminBoardState>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{row.stepCount}</span>;
}

function SharedCell({ row }: AdminCellSlotProps<AdminBoardState>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{row.shareToken === null ? "No" : "Yes"}</span>;
}

function FeaturedCell({ row }: AdminCellSlotProps<AdminBoardState>) {
  const setFeatured = useSetBoardStateFeatured();
  if (!row) {
    return null;
  }
  return (
    <Switch
      checked={row.isFeatured}
      onCheckedChange={(checked: boolean) => setFeatured.mutate({ id: row.id, featured: checked })}
      disabled={setFeatured.isPending || (row.shareToken === null && !row.isFeatured)}
      aria-label={`Feature ${row.title}`}
    />
  );
}

function UpdatedCell({ row }: AdminCellSlotProps<AdminBoardState>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{formatDayTime(row.updatedAt)}</span>;
}

const columns: AdminColumnDef<AdminBoardState>[] = [
  { header: "Title", sortValue: (b) => b.title, cell: <TitleCell /> },
  { header: "Owner", width: "w-44", sortValue: (b) => b.ownerName ?? "", cell: <OwnerCell /> },
  { header: "Rules", width: "w-64", sortValue: rulesLabel, cell: <RulesCell /> },
  { header: "Steps", width: "w-20", sortValue: (b) => b.stepCount, cell: <StepsCell /> },
  {
    header: "Shared",
    width: "w-20",
    sortValue: (b) => (b.shareToken === null ? 0 : 1),
    cell: <SharedCell />,
  },
  {
    header: "Featured",
    width: "w-24",
    sortValue: (b) => (b.isFeatured ? 1 : 0),
    cell: <FeaturedCell />,
  },
  { header: "Updated", width: "w-36", sortValue: (b) => b.updatedAt, cell: <UpdatedCell /> },
];

export function AdminBoardStatesPage() {
  const { data } = useAdminBoardStates();
  const { items } = data;

  return (
    <AdminTable
      columns={columns}
      data={items}
      getRowKey={(boardState) => boardState.id}
      emptyText="No board states yet."
      defaultSort={{ column: "Updated", direction: "desc" }}
      title="Board States"
      toolbar={
        items.length > 0 ? (
          <PageDescription>
            {items.length} board state{items.length === 1 ? "" : "s"}, only shared ones can be
            featured
          </PageDescription>
        ) : undefined
      }
    />
  );
}
