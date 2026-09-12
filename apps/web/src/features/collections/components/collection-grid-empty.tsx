import { Link } from "@tanstack/react-router";
import {
  CameraIcon,
  DownloadIcon,
  LibraryBigIcon,
  PackageIcon,
  SquarePlusIcon,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

interface CollectionGridEmptyProps {
  collectionName: string | undefined;
  inboxName: string | undefined;
  addTarget: string | undefined;
  onBrowseLibrary: () => void;
}

export function CollectionGridEmpty({
  collectionName,
  inboxName,
  addTarget,
  onBrowseLibrary,
}: CollectionGridEmptyProps) {
  return (
    <EmptyState
      className="flex-1"
      icon={PackageIcon}
      title={m.collections_grid_empty_title()}
      description={
        <>
          {collectionName || inboxName
            ? m.collections_grid_empty_description_named({
                name: collectionName ?? inboxName ?? "",
              })
            : m.collections_grid_empty_description()}{" "}
          <Link to="/help/$slug" params={{ slug: "cards-printings-copies" }}>
            {m.collections_grid_empty_learn_link()}
          </Link>
        </>
      }
    >
      <div className="flex flex-wrap justify-center gap-2">
        {addTarget && (
          <>
            <Button onClick={onBrowseLibrary}>
              <LibraryBigIcon />
              {m.collections_grid_empty_browse_add()}
            </Button>
            <Link to="/scan" className={buttonVariants({ variant: "ghost" })}>
              <CameraIcon />
              {m.collections_grid_empty_scan()}
            </Link>
            <Button
              variant="ghost"
              onClick={() => useCommandPaletteStore.getState().openQuickAdd("add")}
            >
              <SquarePlusIcon />
              {m.collections_grid_empty_quick_add()}
            </Button>
          </>
        )}
        <Link to="/collections/import" className={buttonVariants({ variant: "ghost" })}>
          <DownloadIcon />
          {m.collections_grid_empty_import()}
        </Link>
      </div>
    </EmptyState>
  );
}
