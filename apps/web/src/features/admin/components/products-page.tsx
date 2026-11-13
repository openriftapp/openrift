import type { ProductSummary } from "@openrift/shared/contracts/products";
import { RESERVED_PRODUCT_SLUGS, productSlugRegex } from "@openrift/shared/contracts/products";
import { slugifyName } from "@openrift/shared/strings";
import { Link } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { PageDescription, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import {
  CountCell,
  DescriptionInput,
  DraftTextInput,
  InstantCell,
  SlugCell,
} from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { SetPicker } from "@/features/admin/components/set-picker";
import { suggestListIdForProduct } from "@/features/admin/lib/suggest-product-list";
import {
  useCreateProduct,
  useDeleteProduct,
  useProductsList,
  useResyncProduct,
  useUpdateProduct,
} from "@/features/cards/hooks/use-products";
import { useLists } from "@/features/lists/hooks/use-lists";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

import type { AdminCellSlotProps, AdminColumnDef, AdminDraftSlotProps } from "./admin-table";
import { AdminTable } from "./admin-table";

interface ProductDraft {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Set UUID, or "" for no set. */
  setId: string;
}

function validateDraft(draft: { name: string; slug: string }): string | null {
  if (!draft.name.trim()) {
    return "Name is required";
  }
  if (!productSlugRegex.test(draft.slug)) {
    return "Slug must be 3-80 chars of lowercase letters, digits, and dashes";
  }
  if ((RESERVED_PRODUCT_SLUGS as readonly string[]).includes(draft.slug)) {
    return "This slug is reserved";
  }
  return null;
}

function NameCell({ row }: AdminCellSlotProps<ProductSummary>) {
  if (!row) {
    return null;
  }
  return (
    <TextLink
      variant="inherit"
      className="font-medium"
      render={<Link to="/products/$slug" params={{ slug: row.slug }} />}
    >
      {row.name}
    </TextLink>
  );
}

function DescriptionCell({ row }: AdminCellSlotProps<ProductSummary>) {
  return <span className="text-muted-foreground line-clamp-1 max-w-64">{row?.description}</span>;
}

function SetCell({ row }: AdminCellSlotProps<ProductSummary>) {
  return <span className="text-muted-foreground">{row?.set?.name}</span>;
}

function CardTotalCell({ row }: AdminCellSlotProps<ProductSummary>) {
  return <span>{row?.cardTotal}</span>;
}

function SetInput({ draft, setDraft }: AdminDraftSlotProps<ProductDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <SetPicker
      value={draft.setId}
      onChange={(setId) => setDraft((prev) => ({ ...prev, setId }))}
      noneLabel="No set"
    />
  );
}

const productColumns: AdminColumnDef<ProductSummary, ProductDraft>[] = [
  {
    header: "Name",
    sortValue: (p) => p.name,
    cell: <NameCell />,
    editCell: <DraftTextInput<ProductDraft> field="name" />,
  },
  {
    header: "Slug",
    sortValue: (p) => p.slug,
    cell: <SlugCell<ProductSummary> />,
    editCell: (
      <DraftTextInput<ProductDraft> field="slug" letterCase="lower" className="w-56 font-mono" />
    ),
  },
  { header: "Set", sortValue: (p) => p.set?.name ?? "", cell: <SetCell />, editCell: <SetInput /> },
  {
    header: "Description",
    cell: <DescriptionCell />,
    editCell: <DescriptionInput<ProductDraft> placeholder="Optional markdown description" />,
  },
  { header: "Cards", align: "right", sortValue: (p) => p.cardTotal, cell: <CardTotalCell /> },
  {
    header: "Unique",
    align: "right",
    sortValue: (p) => p.printingCount,
    cell: <CountCell<ProductSummary> count={(row) => row.printingCount} />,
  },
  {
    header: "Updated",
    sortValue: (p) => p.updatedAt,
    cell: <InstantCell<ProductSummary> at={(row) => row.updatedAt} relative />,
  },
];

function ListPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (listId: string, listName: string) => void;
}) {
  const { data: lists } = useLists();
  const printingLists = lists
    .filter((list) => list.kind === "printing")
    .toSorted((a, b) => a.name.localeCompare(b.name));

  if (printingLists.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no printing lists yet. Build the product in an organize list with printing
        granularity first, then snapshot it here.
      </p>
    );
  }
  return (
    <ComboboxPicker
      trigger="input"
      options={printingLists.map((list) => ({
        value: list.id,
        label: `${list.name} (${list.entryCount} entries)`,
      }))}
      value={value === "" ? null : value}
      onChange={(listId) => {
        const list = printingLists.find((entry) => entry.id === listId);
        onChange(list?.id ?? "", list?.name ?? "");
      }}
      aria-label="Source list"
      placeholder="Pick one of your printing lists"
      emptyText="No matching lists"
    />
  );
}

const EMPTY_CREATE_DRAFT = { name: "", slug: "", description: "", setId: "", listId: "" };

function CreateProductDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(EMPTY_CREATE_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const createProduct = useCreateProduct();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDraft(EMPTY_CREATE_DRAFT);
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    let validationError = validateDraft(draft);
    if (!validationError && !draft.listId) {
      validationError = "Pick the list to snapshot";
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = {
      name: draft.name.trim(),
      slug: draft.slug,
      description: draft.description.trim() || null,
      setId: draft.setId || null,
      listId: draft.listId,
    };
    const created = await runReportedMutation(
      () => createProduct.mutateAsync(payload),
      (submitError) => setError(errorText(submitError, "Creating the product failed")),
    );
    if (created) {
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>Create product from list</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Source list</Label>
              <ListPicker
                value={draft.listId}
                onChange={(listId, listName) =>
                  setDraft((prev) => ({
                    ...prev,
                    listId,
                    name: listName || prev.name,
                    slug: listName ? slugifyName(listName) : prev.slug,
                  }))
                }
              />
              <p className="text-muted-foreground text-xs">
                The list&apos;s cards and quantities become the product&apos;s contents. The product
                is a snapshot: later list edits don&apos;t apply until you re-sync.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Origins Starter Set"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-slug">Slug</Label>
              <Input
                id="product-slug"
                value={draft.slug}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))
                }
                placeholder="origins-starter-set"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Set</Label>
              <SetPicker
                value={draft.setId}
                onChange={(setId) => setDraft((prev) => ({ ...prev, setId }))}
                noneLabel="No set"
              />
              <p className="text-muted-foreground text-xs">
                The wave the product released with. The public products page groups by it.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional markdown blurb shown on the product page."
                rows={3}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProduct.isPending}>
              Create product
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

function ResyncDialog({
  product,
  onOpenChange,
}: {
  product: ProductSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: lists } = useLists();
  const [listId, setListId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestedFor, setSuggestedFor] = useState<string | null>(null);
  const resyncProduct = useResyncProduct();

  // Sets state during render, not in an effect: must land before the first paint for a new product.
  if (product && product.id !== suggestedFor) {
    setSuggestedFor(product.id);
    setListId(suggestListIdForProduct(lists, product) ?? "");
    setError(null);
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setListId("");
      setError(null);
      setSuggestedFor(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!product) {
      return;
    }
    if (!listId) {
      setError("Pick the list to snapshot");
      return;
    }
    const payload = { id: product.id, listId };
    const resynced = await runReportedMutation(
      () => resyncProduct.mutateAsync(payload),
      (submitError) => setError(errorText(submitError, "Re-syncing failed")),
    );
    if (resynced) {
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={product !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>Re-sync contents{product ? `: ${product.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Replaces the product&apos;s entire contents with a fresh snapshot of the picked list.
            </p>
            <ListPicker value={listId} onChange={setListId} />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={resyncProduct.isPending}>
              Replace contents
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

function ResyncAction({
  row,
  onResync,
}: AdminCellSlotProps<ProductSummary> & { onResync: (product: ProductSummary) => void }) {
  if (!row) {
    return null;
  }
  return (
    <Button variant="ghost" size="sm" onClick={() => onResync(row)}>
      <RefreshCwIcon />
      Re-sync
    </Button>
  );
}

export function AdminProductsPage() {
  const { data } = useProductsList();
  const updateProduct = useUpdateProduct({ inlineError: true });
  const deleteProduct = useDeleteProduct();
  const [createOpen, setCreateOpen] = useState(false);
  const [resyncTarget, setResyncTarget] = useState<ProductSummary | null>(null);

  return (
    <div className="space-y-4">
      <AdminPageTopBar
        title="Products"
        actions={
          <PageTopBarPrimaryButton onClick={() => setCreateOpen(true)}>
            Create product
          </PageTopBarPrimaryButton>
        }
      />
      <AdminTable
        columns={productColumns}
        data={data.products}
        getRowKey={(product) => product.id}
        emptyText="No products yet — create one from a printing list."
        defaultSort={{ column: "Name", direction: "asc" }}
        toolbar={
          <PageDescription>
            Products are public the moment they exist. Contents change only by re-syncing from a
            list.
          </PageDescription>
        }
        edit={{
          toDraft: (product) => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description ?? "",
            setId: product.set?.id ?? "",
          }),
          onSave: (draft) =>
            updateProduct.mutateAsync({
              id: draft.id,
              name: draft.name.trim(),
              slug: draft.slug,
              description: draft.description.trim() || null,
              setId: draft.setId || null,
            }),
          validate: validateDraft,
        }}
        delete={{
          onDelete: (product) => deleteProduct.mutateAsync({ id: product.id }),
          confirm: (product) => ({
            title: `Delete "${product.name}"?`,
            description:
              "The product and its contents are removed immediately. Collections, decks, and lists are not affected.",
          }),
        }}
        actions={<ResyncAction onResync={setResyncTarget} />}
      />
      <CreateProductDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResyncDialog product={resyncTarget} onOpenChange={() => setResyncTarget(null)} />
    </div>
  );
}
