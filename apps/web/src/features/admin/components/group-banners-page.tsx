import type { AdminGroupBanner } from "@openrift/shared/contracts/admin/friend-group-banners";
import { formatDayTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { useGroupBanners, useRemoveGroupBanner } from "@/features/admin/hooks/use-group-banners";

function BannerCell({ row }: AdminCellSlotProps<AdminGroupBanner>) {
  if (!row) {
    return null;
  }
  return (
    <a href={row.bannerUrl} target="_blank" rel="noreferrer">
      <img
        src={row.bannerUrl}
        alt={`Banner of ${row.groupName}`}
        loading="lazy"
        className="bg-muted h-12 w-40 rounded-md border object-cover"
        style={{ objectPosition: `50% ${row.bannerPosition}%` }}
      />
    </a>
  );
}

function GroupCell({ row }: AdminCellSlotProps<AdminGroupBanner>) {
  if (!row) {
    return null;
  }
  return (
    <Link
      to="/groups/$slug"
      params={{ slug: row.groupSlug }}
      className="text-primary hover:text-primary/80 underline underline-offset-4"
    >
      {row.groupName}
    </Link>
  );
}

function MembersCell({ row }: AdminCellSlotProps<AdminGroupBanner>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{row.memberCount}</span>;
}

function UploaderCell({ row }: AdminCellSlotProps<AdminGroupBanner>) {
  if (!row) {
    return null;
  }
  const label = row.uploaderName ?? row.uploaderEmail;
  if (!label) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="max-w-56 truncate" title={row.uploaderEmail ?? undefined}>
      {label}
    </span>
  );
}

function UploadedAtCell({ row }: AdminCellSlotProps<AdminGroupBanner>) {
  if (!row) {
    return null;
  }
  return (
    <span className="text-muted-foreground">
      {row.uploadedAt ? formatDayTime(row.uploadedAt) : "—"}
    </span>
  );
}

function RemoveAction({ row }: AdminCellSlotProps<AdminGroupBanner>) {
  const remove = useRemoveGroupBanner();
  if (!row) {
    return null;
  }
  return (
    <Button variant="ghost" onClick={() => remove.mutate(row.groupId)} disabled={remove.isPending}>
      <Trash2Icon className="size-3.5" />
      Remove
    </Button>
  );
}

const columns: AdminColumnDef<AdminGroupBanner>[] = [
  { header: "Banner", width: "w-44", cell: <BannerCell /> },
  { header: "Group", sortValue: (b) => b.groupName, cell: <GroupCell /> },
  { header: "Members", width: "w-24", sortValue: (b) => b.memberCount, cell: <MembersCell /> },
  {
    header: "Uploaded By",
    width: "w-56",
    sortValue: (b) => b.uploaderName ?? b.uploaderEmail ?? "",
    cell: <UploaderCell />,
  },
  {
    header: "Uploaded At",
    width: "w-36",
    sortValue: (b) => b.uploadedAt ?? "",
    cell: <UploadedAtCell />,
  },
];

export function GroupBannersPage() {
  const { data } = useGroupBanners();
  const { items } = data;

  return (
    <AdminTable
      columns={columns}
      data={items}
      getRowKey={(banner) => banner.groupId}
      emptyText="No group has uploaded a banner."
      defaultSort={{ column: "Uploaded At", direction: "desc" }}
      title="Group Banners"
      toolbar={
        items.length > 0 ? (
          <PageDescription>
            {items.length} group{items.length === 1 ? "" : "s"} with an uploaded banner
          </PageDescription>
        ) : undefined
      }
      actions={<RemoveAction />}
    />
  );
}
