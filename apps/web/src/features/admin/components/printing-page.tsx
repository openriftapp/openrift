import { getOrientation } from "@openrift/shared/card-orientation";
import type { DeskImage, DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { AdminPrintingCitation } from "@openrift/shared/types/api/admin";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CopyIcon,
  CropIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { Suspense, useRef, useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { PageTopBarBack, PageTopBarButton } from "@/components/layout/page-top-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dropzone } from "@/components/ui/dropzone";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import {
  PrintingHistoryCard,
  PrintingMarketplaceCard,
  PrintingSourcesCard,
} from "@/features/admin/components/printing-admin-sections";
import { PrintingDeskEditFields } from "@/features/admin/components/printing-desk-form-page";
import { DeskSegmented, DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { SideSearch } from "@/features/admin/components/side-search";
import { StraightenImageDialog } from "@/features/admin/components/straighten-image-dialog";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useDeletePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useActivatePrintingImage,
  useDeletePrintingImage,
  useRotatePrintingImage,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import {
  useAdminPrintingCitations,
  useCreatePrintingCitation,
  useDeletePrintingCitation,
  useUpdatePrintingCitation,
} from "@/features/admin/hooks/use-admin-printing-citations";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import {
  useDeskPrinting,
  useRemoveDeskSecondSide,
  useSetDeskImageFace,
  useSetDeskSecondSide,
  useUpdateDeskImage,
} from "@/features/admin/hooks/use-printing-desk";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { DeskFaceOption } from "@/features/admin/lib/desk-face-options";
import { deskFaceOptions, deskPrintingName } from "@/features/admin/lib/desk-face-options";
import { deskImageBust, deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { deskPrintingPeriod } from "@/features/admin/lib/printing-desk-status";
import type { PrintingFace } from "@/features/admin/lib/printing-faces";
import { printingFaces } from "@/features/admin/lib/printing-faces";
import { encodePostSlides } from "@/features/admin/lib/printing-post-slides";
import { sourceBrand } from "@/features/admin/lib/source-brand";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { CardDetail } from "@/features/cards/components/card-detail/card-detail";
import { ImageHoverPreview } from "@/features/cards/components/printing-hover-preview";
import { freshCardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { cardsKeys, catalogKeys, promosKeys } from "@/features/cards/lib/cards-query-keys";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { useMouseHover } from "@/hooks/use-mouse-hover";
import { useSession } from "@/hooks/use-session";
import { errorText } from "@/lib/error-text";
import { cn } from "@/lib/utils";

const DESK_IMAGE_SCOPE = [
  adminKeys.printingDesk.all,
  adminKeys.cards.all,
  catalogKeys.all,
  cardsKeys.all,
  promosKeys.all,
] as const;

type Rotation = 0 | 90 | 180 | 270;

export function PrintingPage({ printingId }: { printingId: string }) {
  const { data } = useDeskPrinting(printingId, 1);
  const { data: access } = useAdminAccess();
  const { data: channelData } = useDistributionChannels();

  const isAdmin = access?.isAdmin === true;
  const canOpenCardPages = isAdmin || (access?.sections ?? []).includes("card-review");
  const printing = data.printing;
  const faces = printingFaces(printing);
  const channelPaths = buildChannelBreadcrumbsBySlug(channelData.distributionChannels);
  const channelPath = printing.distributionChannelSlugs
    .map((slug) => channelPaths.get(slug) ?? slug)
    .join(", ");
  const activeFront = data.images.find((image) => image.face === "front" && image.isActive) ?? null;
  const postImage = activeFront ?? data.images.at(0) ?? null;
  const postSlides =
    postImage === null
      ? null
      : encodePostSlides([{ printingId, imageFileId: postImage.imageFileId }]);

  return (
    <div className="space-y-4">
      <AdminPageTopBar
        title={deskPrintingName(printing)}
        back={<PageTopBarBack to="/admin/printing-desk" />}
        actions={
          <>
            {postSlides === null ? (
              <PageTopBarButton disabled>
                <Share2Icon />
                Make a post
              </PageTopBarButton>
            ) : (
              <Link
                to="/admin/printing-desk/post"
                search={{ slides: postSlides }}
                className={buttonVariants({ variant: "ghost" })}
              >
                <Share2Icon />
                Make a post
              </Link>
            )}
            {isAdmin && <PrintingActionsMenu printing={printing} />}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {channelPath.length > 0 && <Badge variant="neutral">{channelPath}</Badge>}
        <Badge variant="outline" className="font-mono">
          {faces.map((face) => formatPrintingCode(face.publicCode)).join(" // ")}
        </Badge>
        <DeskStatusBadge row={printing} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {faces.map((face) => (
              <FaceCard
                key={face.faceId}
                printing={printing}
                face={face}
                images={data.images}
                faceCount={faces.length}
                canOpenCardPages={canOpenCardPages}
              />
            ))}
            {faces.length === 1 && printing.canEdit && <AddFaceCard printing={printing} />}
          </div>

          <PrintingFieldsCard printing={printing} channelPath={channelPath} />
          {isAdmin && (
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
              <PrintingSourcesCard printingId={printingId} faces={faces} />
              <PrintingMarketplaceCard printingId={printingId} cardSlug={printing.cardSlug} />
            </Suspense>
          )}
          <LinksCard printingId={printingId} />
          {isAdmin && <PrintingHistoryCard printingId={printingId} />}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>On the card page</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
              <CardPagePreview cardSlug={printing.cardSlug} printingId={printingId} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FaceCard({
  printing,
  face,
  images,
  faceCount,
  canOpenCardPages,
}: {
  printing: DeskPrintingRow;
  face: PrintingFace;
  images: DeskImage[];
  faceCount: number;
  canOpenCardPages: boolean;
}) {
  const { labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const { data: markerData } = useMarkers();
  const removeFace = useRemoveDeskSecondSide();
  const [editing, setEditing] = useState(false);

  const markerLabels = new Map(markerData.markers.map((marker) => [marker.slug, marker.label]));
  const markers = face.markerSlugs.map((slug) => markerLabels.get(slug) ?? slug).join(", ");

  return (
    <Card data-face-id={face.faceId}>
      <CardHeader>
        <CardTitle>
          Face {face.position} · {face.cardName}
        </CardTitle>
        {canOpenCardPages && (
          <CardDescription>
            <Link
              to="/admin/cards/$cardSlug"
              params={{ cardSlug: face.cardSlug }}
              search={{ section: "printings", face: face.faceId }}
              className="underline"
            >
              Review on {face.cardName}&apos;s card page
            </Link>
          </CardDescription>
        )}
        {printing.canEdit && !editing && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
            <PrintingDeskEditFields
              printingId={printing.printingId}
              side={face.position}
              scope="face"
              onSaved={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          </Suspense>
        ) : (
          <DefinitionList className="sm:grid-cols-[max-content_minmax(0,1fr)]">
            <DetailRow label="Code" value={formatPrintingCode(face.publicCode)} />
            <DetailRow label="Set" value={face.setName} />
            <DetailRow label="Finish" value={enumLabel(labels.finishes, face.finish)} />
            <DetailRow label="Language" value={languageLabels[face.language] ?? face.language} />
            <DetailRow label="Rarity" value={enumLabel(labels.rarities, face.rarity)} />
            <DetailRow label="Artist" value={face.artist} />
            <DetailRow label="Markers" value={markers.length > 0 ? markers : "None"} />
          </DefinitionList>
        )}

        {face.sharedWith.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Also on{" "}
            {face.sharedWith.map((shared, index) => (
              <span key={shared.printingId}>
                {index > 0 && ", "}
                <Link
                  to="/admin/printings/$printingId"
                  params={{ printingId: shared.printingId }}
                  className="underline"
                >
                  {formatPrintingCode(shared.publicCode)}
                </Link>
              </span>
            ))}
            . Editing this face changes those printings too.
          </p>
        )}

        <FaceImages printing={printing} face={face} images={images} />

        {faceCount > 1 && printing.canEdit && (
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={removeFace.isPending}
              onClick={() =>
                removeFace.mutate({ printingId: printing.printingId, faceId: face.faceId })
              }
            >
              <XIcon />
              Remove this face
            </Button>
            {removeFace.error && (
              <p className="text-destructive text-sm">
                {errorText(removeFace.error, "Could not remove the face.")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrintingActionsMenu({ printing }: { printing: DeskPrintingRow }) {
  const navigate = useNavigate();
  const deletePrinting = useDeletePrinting([
    adminKeys.cards.all,
    adminKeys.printingDesk.all,
    catalogKeys.all,
  ]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const name = deskPrintingName(printing);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <EllipsisVerticalIcon />
          <span className="sr-only">Printing actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link
                to="/admin/cards/$cardSlug/printings/create"
                params={{ cardSlug: printing.cardSlug }}
                search={{ duplicateFrom: printing.printingId }}
              />
            }
          >
            <CopyIcon className="mr-2" />
            Duplicate printing
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={deletePrinting.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete printing "${name}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={deletePrinting.isPending}
        onConfirm={() =>
          deletePrinting.mutate(printing.printingId, {
            onSuccess: () =>
              void navigate({
                to: "/admin/cards/$cardSlug",
                params: { cardSlug: printing.cardSlug },
                search: { section: "printings" },
              }),
          })
        }
      />
    </>
  );
}

function AddFaceCard({ printing }: { printing: DeskPrintingRow }) {
  const setSecondFace = useSetDeskSecondSide();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Face 2</CardTitle>
        <CardDescription>
          For a double-faced token, pick the printing&apos;s other face.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <SideSearch
          excludeFaceIds={[printing.faceId]}
          disabled={setSecondFace.isPending}
          onPick={(side) =>
            setSecondFace.mutate({ printingId: printing.printingId, faceId: side.faceId })
          }
        />
        {setSecondFace.error && (
          <p className="text-destructive text-sm">
            {errorText(setSecondFace.error, "Could not add the face.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FaceImages({
  printing,
  face,
  images,
}: {
  printing: DeskPrintingRow;
  face: PrintingFace;
  images: DeskImage[];
}) {
  const { data: session } = useSession();
  const uploadImage = useUploadPrintingImage(DESK_IMAGE_SCOPE);
  const activateImage = useActivatePrintingImage(DESK_IMAGE_SCOPE);
  const [uploading, setUploading] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const printingId = printing.printingId;
  const faceImages = images.filter((image) => image.face === face.imageFace);
  const activeId = faceImages.find((image) => image.isActive)?.printingImageId ?? "";
  const sideOptions = deskFaceOptions(printing);
  const uploaderName = session?.user.name ?? "";

  async function handleFiles(files: File[]) {
    setUploadError(null);
    const credit = uploaderName.length > 0 ? uploaderName : undefined;
    for (const file of files) {
      setUploading((current) => [...current, file.name]);
      try {
        await uploadImage.mutateAsync({
          printingId,
          file,
          mode: "additional",
          face: face.imageFace,
          credit,
        });
      } catch (error) {
        setUploadError(errorText(error, `Could not upload ${file.name}.`));
      }
      setUploading((current) => current.filter((name) => name !== file.name));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Images</p>
        {activeId !== "" && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => activateImage.mutate({ imageId: activeId, active: false })}
          >
            Clear
          </Button>
        )}
      </div>

      <Dropzone
        multiple
        accept="image/*"
        disabled={uploading.length > 0}
        icon={<UploadIcon className="text-muted-foreground size-5" />}
        label="Drop images here or click to choose"
        hint="JPG, PNG or WebP, up to 50 MB each. Landscape is fine, battlefields get turned for you."
        onFiles={(files) => void handleFiles(files)}
      />

      {uploading.map((name) => (
        <p key={name} className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner />
          Uploading {name}…
        </p>
      ))}

      {uploadError && (
        <Alert variant="destructive">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {faceImages.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No images yet. The card page falls back to the base printing&apos;s art.
        </p>
      ) : (
        <RadioGroup
          aria-label={`Active image for ${face.cardName}`}
          value={activeId}
          onValueChange={(value) => {
            if (typeof value === "string" && value !== "") {
              activateImage.mutate({ imageId: value, active: true });
            }
          }}
          className="gap-2"
        >
          {faceImages.map((image) => (
            <DeskImageRow
              key={image.printingImageId}
              printingId={printingId}
              image={image}
              cardName={face.cardName}
              sideOptions={sideOptions}
              landscape={getOrientation([printing.cardType]) === "landscape"}
            />
          ))}
        </RadioGroup>
      )}
    </div>
  );
}

function CardPagePreview({ cardSlug, printingId }: { cardSlug: string; printingId: string }) {
  const { data } = useSuspenseQuery(freshCardDetailQueryOptions(cardSlug));
  const printing = data.printings.find((entry) => entry.printingId === printingId);

  if (!printing) {
    return (
      <p className="text-muted-foreground text-sm">
        Not on the card page yet. It appears once the catalog picks the printing up.
      </p>
    );
  }

  return <CardDetail printing={printing} showImages showPrices={false} />;
}

function PrintingFieldsCard({
  printing,
  channelPath,
}: {
  printing: DeskPrintingRow;
  channelPath: string;
}) {
  const { labels } = useEnumOrders();
  const [editing, setEditing] = useState(false);
  const canEdit = printing.canEdit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Printing</CardTitle>
        {printing.secondSide !== null && <CardDescription>Shared by both faces.</CardDescription>}
        {canEdit && !editing && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
            <PrintingDeskEditFields
              printingId={printing.printingId}
              scope="printing"
              onSaved={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          </Suspense>
        ) : (
          <>
            <DefinitionList className="sm:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]">
              <DetailRow label="Channel" value={channelPath.length > 0 ? channelPath : "None"} />
              <DetailRow label="Size" value={enumLabel(labels.cardSizes, printing.size)} />
              {printing.announcedAt !== null && (
                <DetailRow label="Announced on" value={formatDay(printing.announcedAt)} />
              )}
              <DetailRow label="Available from" value={deskPrintingPeriod(printing)} />
            </DefinitionList>

            {printing.comment !== null && printing.comment.length > 0 && (
              <p className="text-muted-foreground mt-3 text-sm">{printing.comment}</p>
            )}

            {!canEdit && (
              <p className="text-muted-foreground mt-3 text-sm">
                Not a promo. Only the admin changes this printing.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <DefinitionTerm>{label}</DefinitionTerm>
      <DefinitionDetail className="truncate">{value}</DefinitionDetail>
    </div>
  );
}

function DeskImageRow({
  printingId,
  image,
  cardName,
  sideOptions,
  landscape,
}: {
  printingId: string;
  image: DeskImage;
  cardName: string;
  sideOptions: DeskFaceOption[];
  landscape: boolean;
}) {
  const rotateImage = useRotatePrintingImage(DESK_IMAGE_SCOPE);
  const deleteImage = useDeletePrintingImage(DESK_IMAGE_SCOPE);
  const updateImage = useUpdateDeskImage();
  const setFace = useSetDeskImageFace();
  const rowRef = useRef<HTMLDivElement>(null);
  const { hovering, hoverProps } = useMouseHover();
  const [straightening, setStraightening] = useState(false);

  const storedCredit = image.credit ?? "";
  // The row keeps rendering while a save is in flight, so the stored value is
  // copied in when it changes, not only seeded at mount.
  const [credit, setCredit] = useState(storedCredit);
  const [lastCredit, setLastCredit] = useState(storedCredit);
  if (storedCredit !== lastCredit) {
    setLastCredit(storedCredit);
    setCredit(storedCredit);
  }

  const bust = deskImageBust(image);
  const fullUrl = deskImageSrc(image.url, "full", bust);

  function rotate(by: 90 | 270) {
    const next = ((image.rotation + by) % 360) as Rotation;
    rotateImage.mutate({ imageId: image.printingImageId, rotation: next });
  }

  function saveCredit() {
    const next = credit.trim();
    if (next !== storedCredit) {
      updateImage.mutate({
        imageFileId: image.imageFileId,
        credit: next.length > 0 ? next : null,
      });
    }
  }

  return (
    <div ref={rowRef} {...hoverProps} className="rounded-lg border p-2">
      <div className="flex flex-wrap items-center gap-3">
        <CardArtThumb
          src={deskImageSrc(image.url, "240w", bust)}
          landscape={landscape}
          alt={cardName}
          loading="lazy"
          className="h-14"
        />
        {hovering && !straightening && (
          <ImageHoverPreview
            thumbnailUrl={deskImageSrc(image.url, "400w", bust)}
            fullUrl={fullUrl}
            landscape={landscape}
            anchorRef={rowRef}
          />
        )}

        <div className="space-y-1 text-sm">
          {sideOptions.length > 1 && (
            <DeskSegmented
              ariaLabel="Face"
              value={image.face}
              onChange={(next) =>
                setFace.mutate({ printingImageId: image.printingImageId, printingId, face: next })
              }
              options={sideOptions}
            />
          )}
          <p className="text-muted-foreground text-xs">Turned {image.rotation}°</p>
        </div>

        <Input
          aria-label="Image credit"
          className="order-last w-full lg:order-none lg:w-auto lg:min-w-40 lg:flex-1"
          value={credit}
          placeholder="Who made this image"
          onChange={(event) => setCredit(event.target.value)}
          onBlur={saveCredit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              saveCredit();
            }
          }}
        />

        <span className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Turn left"
            onClick={() => rotate(270)}
            disabled={rotateImage.isPending}
          >
            <RotateCcwIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Turn right"
            onClick={() => rotate(90)}
            disabled={rotateImage.isPending}
          >
            <RotateCwIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={image.quad === null ? "Straighten" : "Straighten (corners set)"}
            onClick={() => setStraightening(true)}
          >
            <CropIcon className={cn(image.quad !== null && "text-success")} />
          </Button>
          {fullUrl !== null && (
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open full size"
              className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
            >
              <ExternalLinkIcon />
            </a>
          )}

          <label
            htmlFor={`active-${image.printingImageId}`}
            className="flex shrink-0 items-center gap-1.5 text-sm"
          >
            <RadioGroupItem id={`active-${image.printingImageId}`} value={image.printingImageId} />
            Active
          </label>

          {image.canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete image"
              onClick={() => deleteImage.mutate(image.printingImageId)}
              disabled={deleteImage.isPending}
            >
              <Trash2Icon />
            </Button>
          )}
        </span>
      </div>

      <StraightenImageDialog
        imageId={image.printingImageId}
        quad={image.quad}
        invalidates={DESK_IMAGE_SCOPE}
        open={straightening}
        onOpenChange={setStraightening}
      />
    </div>
  );
}

function LinksCard({ printingId }: { printingId: string }) {
  const { data } = useAdminPrintingCitations(printingId);
  const createCitation = useCreatePrintingCitation();
  const updateCitation = useUpdatePrintingCitation();
  const deleteCitation = useDeletePrintingCitation();
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const citations = data?.citations ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Links</CardTitle>
        <CardDescription>Where the printing was shown or announced.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {citations.map((citation) => (
          <CitationRow
            key={citation.id}
            citation={citation}
            onSave={(sourceUrl) =>
              updateCitation.mutate({ printingId, citationId: citation.id, sourceUrl })
            }
            onDelete={() => deleteCitation.mutate({ printingId, citationId: citation.id })}
          />
        ))}

        <div className="flex flex-wrap items-end gap-2">
          <Field className="min-w-40 flex-1">
            <FieldLabel htmlFor="desk-link-label">Add link</FieldLabel>
            <Input
              id="desk-link-label"
              value={newLabel}
              placeholder="Launch party unboxing"
              onChange={(event) => setNewLabel(event.target.value)}
            />
          </Field>
          <Input
            aria-label="Link address"
            className="min-w-48 flex-1"
            value={newUrl}
            placeholder="https://…"
            onChange={(event) => setNewUrl(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={newLabel.trim().length === 0 || createCitation.isPending}
            onClick={() => {
              createCitation.mutate({
                printingId,
                label: newLabel.trim(),
                sourceUrl: newUrl.trim().length > 0 ? newUrl.trim() : null,
              });
              setNewLabel("");
              setNewUrl("");
            }}
          >
            <PlusIcon />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CitationRow({
  citation,
  onSave,
  onDelete,
}: {
  citation: AdminPrintingCitation;
  onSave: (sourceUrl: string | null) => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState(citation.sourceUrl ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex min-w-32 flex-1 items-center gap-1.5 truncate text-sm">
        <BrandGlyph icon={sourceBrand(url)} fallback={LinkIcon} className="size-3.5" />
        <span className="truncate">{citation.label}</span>
      </span>
      <Input
        aria-label={`Link for ${citation.label}`}
        className="min-w-48 flex-1"
        value={url}
        placeholder="https://…"
        disabled={!citation.canEdit}
        onChange={(event) => setUrl(event.target.value)}
        onBlur={() => {
          const next = url.trim();
          if (next !== (citation.sourceUrl ?? "")) {
            onSave(next.length > 0 ? next : null);
          }
        }}
      />
      {citation.canEdit && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${citation.label}`}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  );
}
