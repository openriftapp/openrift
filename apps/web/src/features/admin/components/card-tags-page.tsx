import { matchesTextQuery } from "@openrift/shared/search-fold";
import type { ClassifiedCardTag, TagCategoryResponse } from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Toggle } from "@/components/ui/toggle";
import { CountCell } from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { TagCategoriesTable } from "@/features/admin/components/tag-categories-table";
import {
  useCardTags,
  useCreateTagCategory,
  useDeleteTagCategory,
  useDetectLegendTags,
  useSetTagCategory,
  useTagCategoryList,
  useUpdateTagCategory,
} from "@/features/cards/hooks/use-card-tags";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const UNCLASSIFIED = "__unclassified";

function CardTagCategoriesSection({ categories }: { categories: TagCategoryResponse[] }) {
  const createMutation = useCreateTagCategory({ inlineError: true });
  const updateMutation = useUpdateTagCategory({ inlineError: true });
  const deleteMutation = useDeleteTagCategory();
  return (
    <TagCategoriesTable
      categories={categories}
      slugExample="species"
      labelExample="Species"
      emptyText="No categories yet — create one before classifying tags."
      description="Groups printed tags into filter sections. Delete is blocked while tags are classified under a category."
      onCreate={(input) => createMutation.mutateAsync(input)}
      onUpdate={(input) => updateMutation.mutateAsync(input)}
      onDelete={(id) => deleteMutation.mutateAsync(id)}
    />
  );
}

export function CardTagsPage() {
  const { data: tagsData } = useCardTags();
  const { data: categoriesData } = useTagCategoryList();

  return (
    <div className="space-y-8">
      <AdminPageTopBar title="Card Tags" />
      <CardTagCategoriesSection categories={categoriesData.categories} />

      <ClassificationSection tags={tagsData.tags} categories={categoriesData.categories} />
    </div>
  );
}

function TagNameCell({ row }: AdminCellSlotProps<ClassifiedCardTag>) {
  if (!row) {
    return null;
  }
  return (
    <span>
      {row.tag}
      {row.cardCount === 0 && (
        <span className="text-muted-foreground ml-2 text-xs">no longer on any card</span>
      )}
    </span>
  );
}

interface ClassificationSelectProps extends AdminCellSlotProps<ClassifiedCardTag> {
  items: { value: string; label: string }[];
  onSetCategory?: (tag: string, categoryId: string | null) => void;
}

function ClassificationCategorySelect({ row, items, onSetCategory }: ClassificationSelectProps) {
  if (!row) {
    return null;
  }
  return (
    <SimpleSelect
      items={items}
      value={row.categoryId ?? UNCLASSIFIED}
      onChange={(next) => onSetCategory?.(row.tag, next === UNCLASSIFIED ? null : next)}
      label={`Category for ${row.tag}`}
      size="sm"
      className="w-44"
    />
  );
}

function ClassificationSection({
  tags,
  categories,
}: {
  tags: ClassifiedCardTag[];
  categories: TagCategoryResponse[];
}) {
  const setCategoryMutation = useSetTagCategory();
  const detectMutation = useDetectLegendTags();
  const [filter, setFilter] = useState("");
  const [unclassifiedOnly, setUnclassifiedOnly] = useState(false);
  const [detectResult, setDetectResult] = useState<string | null>(null);

  // Target for the detect helper: the "legend" category by convention,
  // falling back to nothing (button disabled) if it was deleted/renamed away.
  const legendCategory = categories.find((cat) => cat.slug === "legend");
  const detectLegendTags = async () => {
    if (!legendCategory) {
      return;
    }
    let result: Awaited<ReturnType<typeof detectMutation.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await detectMutation.mutateAsync({ categoryId: legendCategory.id });
    });
    if (!ok || !result) {
      return;
    }
    if (result.assigned === 0) {
      setDetectResult(`All ${result.found} Legend tags were already classified.`);
    } else {
      setDetectResult(
        `Classified ${result.assigned} of ${result.found} Legend tags as ${legendCategory.label}.`,
      );
    }
  };

  const categoryItems = [
    { value: UNCLASSIFIED, label: "Unclassified" },
    ...categories.map((cat) => ({ value: cat.id, label: cat.label })),
  ];

  const visible = tags
    .filter((tag) => matchesTextQuery(filter, [tag.tag]))
    .filter((tag) => (unclassifiedOnly ? tag.categoryId === null : true))
    // Unclassified tags first, then alphabetical.
    .toSorted(
      (a, b) =>
        Number(a.categoryId !== null) - Number(b.categoryId !== null) || a.tag.localeCompare(b.tag),
    );
  const unclassifiedCount = tags.filter((tag) => tag.categoryId === null).length;

  const columns: AdminColumnDef<ClassifiedCardTag, never>[] = [
    {
      header: "Tag",
      sortValue: (t) => t.tag,
      cell: <TagNameCell />,
    },
    {
      header: "Cards",
      sortValue: (t) => t.cardCount,
      align: "right",
      cell: <CountCell<ClassifiedCardTag> count={(row) => row.cardCount} />,
    },
    {
      header: "Category",
      sortValue: (t) => t.categoryId ?? "",
      cell: (
        <ClassificationCategorySelect
          items={categoryItems}
          onSetCategory={(tag, categoryId) => setCategoryMutation.mutate({ tag, categoryId })}
        />
      ),
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={visible}
      getRowKey={(t) => t.tag}
      emptyText={filter.trim() || unclassifiedOnly ? "No tags match." : "No printed tags found."}
      toolbar={
        <div className="space-y-3">
          <PageDescription>
            New sets add tags as unclassified. They show under &ldquo;Other tags&rdquo; in the
            filters until classified here.
          </PageDescription>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={filter}
              onValueChange={setFilter}
              placeholder="Filter tags…"
              className="w-56"
            />
            <Toggle
              variant="outline"
              pressed={unclassifiedOnly}
              onPressedChange={setUnclassifiedOnly}
              aria-label="Show unclassified tags only"
            >
              Unclassified only ({unclassifiedCount})
            </Toggle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void detectLegendTags()}
              disabled={!legendCategory || detectMutation.isPending}
              title={
                legendCategory
                  ? "Classify every tag found on a Legend card as Legend"
                  : "Create a category with slug 'legend' first"
              }
            >
              Detect legend tags
            </Button>
            {detectResult && <span className="text-muted-foreground text-sm">{detectResult}</span>}
          </div>
        </div>
      }
    />
  );
}
