import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import type {
  FrameOutlineLabel,
  FrameOutlineLabels,
  OutlineLabelPoint,
  OutlineLabelQuad,
} from "@/features/admin/lib/outline-labels";
import {
  addCard,
  doneCount,
  outlineLabelFolder,
  outlineLabelMargin,
  outlineLabelStorageKey,
  outlineLabelsFromProposals,
  outlineLabelsFromSaved,
  mergeOpenedOutlineLabels,
  moveCard,
  moveCorner,
  moveEdge,
  nearestCorner,
  removeCard,
  serializeOutlineLabels,
  serializeStoredOutlineLabels,
  storedOutlineLabelsFor,
} from "@/features/admin/lib/outline-labels";
import { downloadText } from "@/lib/download";
import { cn, PAGE_WIDTH } from "@/lib/utils";

const EMPTY_LABEL: FrameOutlineLabel = { cards: [], done: false };
const ZOOMS = [1, 1.5, 2, 3, 4];

interface Frame {
  name: string;
  url: string;
}

function readStored(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

async function readJsonFile(file?: File): Promise<{ json: unknown } | { error: string }> {
  if (!file) {
    return { json: null };
  }
  try {
    return { json: JSON.parse(await file.text()) };
  } catch {
    return { error: `${file.name} is not valid JSON.` };
  }
}

export function OutlineLabelPage() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [labels, setLabels] = useState<FrameOutlineLabels>({});
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [margin, setMargin] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);
  const [keptAutosave, setKeptAutosave] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [menuCard, setMenuCard] = useState<number | null>(null);
  const dragRef = useRef<
    | { card: number; corner: number }
    | { card: number; edge?: number; from: OutlineLabelPoint; original: OutlineLabelQuad }
    | null
  >(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const frame = frames[current];
  const label = frame ? (labels[frame.name] ?? EMPTY_LABEL) : EMPTY_LABEL;

  useEffect(() => {
    if (folder === null) {
      return;
    }
    const key = outlineLabelStorageKey(folder);
    const text = serializeStoredOutlineLabels(folder, labels);
    try {
      localStorage.setItem(key, text);
    } catch {
      // Private windows and full storage only lose the autosave; Save still works.
    }
  }, [folder, labels]);

  useEffect(
    () => () => {
      for (const opened of frames) {
        URL.revokeObjectURL(opened.url);
      }
    },
    [frames],
  );

  function update(next: FrameOutlineLabel): void {
    if (!frame) {
      return;
    }
    setLabels((all) => ({ ...all, [frame.name]: next }));
  }

  function go(index: number): void {
    setCurrent(Math.max(0, Math.min(frames.length - 1, index)));
    setSelected(null);
    setSize(null);
  }

  async function openFiles(list: FileList | null): Promise<void> {
    if (!list) {
      return;
    }
    const files = [...list];
    const proposals = await readJsonFile(files.find((file) => file.name === "proposals.json"));
    if ("error" in proposals) {
      setOpenError(proposals.error);
      return;
    }
    const saved = await readJsonFile(
      files.find((file) => file.name.startsWith("scan-labels") && file.name.endsWith(".json")),
    );
    if ("error" in saved) {
      setOpenError(saved.error);
      return;
    }
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const images = imageFiles
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    const opened = outlineLabelFolder(imageFiles);
    const merged = mergeOpenedOutlineLabels(
      outlineLabelsFromProposals(proposals.json),
      storedOutlineLabelsFor(readStored(outlineLabelStorageKey(opened)), opened),
      outlineLabelsFromSaved(saved.json),
    );
    setLabels(merged.labels);
    setKeptAutosave(merged.keptAutosave);
    setOpenError(null);
    setFolder(opened);
    setFrames(images);
    setCurrent(0);
    setSelected(null);
    setSize(null);
  }

  function toImage(event: { clientX: number; clientY: number }): OutlineLabelPoint | null {
    const svg = svgRef.current;
    if (!svg || !size) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round(
        ((event.clientX - rect.left) * (size.width + 2 * margin)) / rect.width - margin,
      ),
      y: Math.round(
        ((event.clientY - rect.top) * (size.height + 2 * margin)) / rect.height - margin,
      ),
    };
  }

  function handleMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const drag = dragRef.current;
    const point = toImage(event);
    if (!drag || !point) {
      return;
    }
    if ("corner" in drag) {
      update(moveCorner(label, drag.card, drag.corner, point));
      return;
    }
    const by = { x: point.x - drag.from.x, y: point.y - drag.from.y };
    update(
      drag.edge === undefined
        ? moveCard(label, drag.card, drag.original, by)
        : moveEdge(label, drag.card, drag.edge, drag.original, by),
    );
  }

  function startDrag(event: ReactPointerEvent<SVGElement>, card: number, corner: number): void {
    event.stopPropagation();
    if (event.button !== 0) {
      return;
    }
    dragRef.current = { card, corner };
    setSelected(card);
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function startCardDrag(event: ReactPointerEvent<SVGElement>, card: number, edge?: number): void {
    event.stopPropagation();
    const from = toImage(event);
    const original = label.cards[card];
    setSelected(card);
    if (event.button !== 0 || !from || !original) {
      return;
    }
    dragRef.current = { card, edge, from, original };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function snapNearestCorner(event: ReactPointerEvent<SVGSVGElement>): void {
    if (
      event.button !== 0 ||
      event.target instanceof SVGCircleElement ||
      event.target instanceof SVGLineElement
    ) {
      return;
    }
    const point = toImage(event);
    const nearest = point ? nearestCorner(label.cards, point) : null;
    if (!point || !nearest) {
      return;
    }
    update(moveCorner(label, nearest.card, nearest.corner, point));
    dragRef.current = nearest;
    setSelected(nearest.card);
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function endDrag(): void {
    dragRef.current = null;
    if (size) {
      setMargin(outlineLabelMargin(label.cards, size));
    }
  }

  function toggleDone(): void {
    update({ ...label, done: !label.done });
    if (!label.done) {
      go(current + 1);
    }
  }

  function add(center?: OutlineLabelPoint): void {
    if (size) {
      update(addCard(label, size.width, size.height, center));
      setSelected(label.cards.length);
    }
  }

  function remove(): void {
    if (selected !== null) {
      update(removeCard(label, selected));
      setSelected(null);
    }
  }

  function copyPrevious(): void {
    const previous = frames[current - 1];
    const source = previous ? labels[previous.name] : undefined;
    if (source) {
      update({
        ...label,
        cards: source.cards.map((quad) => quad.map((point) => ({ ...point })) as OutlineLabelQuad),
      });
      setSelected(null);
    }
  }

  function zoomBy(step: number): void {
    setZoom((value) => {
      const index = ZOOMS.indexOf(value) + step;
      return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, index))] ?? value;
    });
  }

  function save(): void {
    downloadText(serializeOutlineLabels(labels), "application/json", "scan-labels.json");
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    if (event.key === "n" || event.key === "ArrowRight") {
      go(current + 1);
    } else if (event.key === "p" || event.key === "ArrowLeft") {
      go(current - 1);
    } else if (event.key === "d") {
      toggleDone();
    } else if (event.key === "c") {
      copyPrevious();
    } else if (event.key === "a") {
      add();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      remove();
    } else if (event.key === "+" || event.key === "=") {
      zoomBy(1);
    } else if (event.key === "-") {
      zoomBy(-1);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    globalThis.addEventListener("keydown", listener);
    return () => globalThis.removeEventListener("keydown", listener);
  }, []);

  const handle = (size ? Math.max(6, size.width * 0.012) : 6) / zoom;
  const stroke = (size ? Math.max(2, size.width * 0.003) : 2) / zoom;

  return (
    <>
      <AdminPageTopBar title="Outline Labels" />
      <div className={cn(PAGE_WIDTH.full, "px-safe flex flex-col gap-4 pb-12")}>
        <PageDescription>
          Open the frame folder: every image plus proposals.json, and a saved scan-labels.json to
          continue. A click or drag near a corner moves that corner there. Drag inside an outline to
          move the whole card, or drag an edge to move its two corners. Add cards that have no
          outline, remove outlines that are not a card, then mark the frame done. A frame counts for
          training only once every card in it is outlined. Keys: n and p move between frames, d
          marks done, c copies the previous frame&apos;s outlines, a or a right click on the image
          adds a card, a right click on an outline deletes it, Delete removes the selected one, +
          and - zoom.
        </PageDescription>
        <div className="flex flex-col gap-2">
          <Label htmlFor="label-files">Frames</Label>
          <Input
            id="label-files"
            type="file"
            multiple
            accept="image/*,.json"
            onChange={(event) => void openFiles(event.target.files)}
          />
          {openError && <p className="text-destructive">{openError}</p>}
          {keptAutosave > 0 && (
            <p className="text-muted-foreground">
              Kept this browser&apos;s autosave for {keptAutosave}{" "}
              {keptAutosave === 1 ? "frame" : "frames"} that differ from the opened
              scan-labels.json.
            </p>
          )}
        </div>
        {frame ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => go(current - 1)} disabled={current === 0}>
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => go(current + 1)}
                disabled={current === frames.length - 1}
              >
                Next
              </Button>
              <Button variant="outline" onClick={copyPrevious} disabled={current === 0}>
                Use previous frame
              </Button>
              <Button variant="outline" onClick={() => add()} disabled={!size}>
                Add card
              </Button>
              <Button variant="outline" onClick={remove} disabled={selected === null}>
                Remove card
              </Button>
              <Button variant={label.done ? "secondary" : "default"} onClick={toggleDone}>
                {label.done ? "Done (undo)" : "Mark done"}
              </Button>
              <Button variant="outline" onClick={save}>
                Save labels
              </Button>
              <Button variant="outline" onClick={() => zoomBy(-1)} disabled={zoom === ZOOMS[0]}>
                Zoom out
              </Button>
              <Button variant="outline" onClick={() => zoomBy(1)} disabled={zoom === ZOOMS.at(-1)}>
                Zoom in
              </Button>
              <span className="text-muted-foreground text-sm">{zoom}x</span>
              <span className="text-muted-foreground text-sm">
                {frame.name}: frame {current + 1} of {frames.length}, {doneCount(labels)} done
              </span>
            </div>
            <div className="overflow-auto">
              <img
                src={frame.url}
                alt=""
                className="hidden"
                onLoad={(event) => {
                  const loaded = {
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  };
                  setSize(loaded);
                  setMargin(outlineLabelMargin(label.cards, loaded));
                }}
              />
              {size ? (
                <ContextMenu>
                  <ContextMenuTrigger className="block">
                    {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drawing canvas; the a, d and Delete keys cover its mouse actions */}
                    <svg
                      ref={svgRef}
                      viewBox={`${-margin} ${-margin} ${size.width + 2 * margin} ${size.height + 2 * margin}`}
                      className="bg-muted block touch-none"
                      style={{
                        aspectRatio: `${size.width + 2 * margin} / ${size.height + 2 * margin}`,
                        width: `calc(${zoom} * min(100%, calc(85vh * ${(size.width + 2 * margin) / (size.height + 2 * margin)})))`,
                        maxWidth: "none",
                      }}
                      role="application"
                      aria-label="Card outlines"
                      onPointerDown={snapNearestCorner}
                      onPointerMove={handleMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onContextMenu={(event) => {
                        if (
                          event.target instanceof SVGPolygonElement ||
                          event.target instanceof SVGLineElement
                        ) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        add(toImage(event) ?? undefined);
                      }}
                    >
                      <image href={frame.url} width={size.width} height={size.height} />
                      <rect
                        width={size.width}
                        height={size.height}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={stroke / 2}
                        strokeDasharray={`${stroke * 4} ${stroke * 4}`}
                      />
                      {label.cards.map((quad, card) => (
                        // oxlint-disable-next-line react/no-array-index-key -- outlines have no identity beyond their position
                        <g key={card}>
                          <polygon
                            points={quad.map((point) => `${point.x},${point.y}`).join(" ")}
                            className={cn(
                              "cursor-grab",
                              selected === card
                                ? "fill-warning-soft stroke-warning"
                                : "fill-success-soft stroke-success",
                            )}
                            strokeWidth={stroke}
                            onPointerDown={(event) => {
                              const point = toImage(event);
                              if (event.shiftKey || !point || !nearestCorner(label.cards, point)) {
                                startCardDrag(event, card);
                              }
                            }}
                            onContextMenu={() => {
                              setSelected(card);
                              setMenuCard(card);
                            }}
                          />
                          {quad.map((point, edge) => {
                            const next = quad[(edge + 1) % 4] ?? point;
                            return (
                              <line
                                // oxlint-disable-next-line react/no-array-index-key -- a card always has the same four edges
                                key={edge}
                                x1={point.x}
                                y1={point.y}
                                x2={next.x}
                                y2={next.y}
                                stroke="transparent"
                                strokeWidth={handle * 1.5}
                                className="cursor-pointer"
                                onPointerDown={(event) => startCardDrag(event, card, edge)}
                                onContextMenu={() => {
                                  setSelected(card);
                                  setMenuCard(card);
                                }}
                              />
                            );
                          })}
                          {quad.map((point, corner) => (
                            <circle
                              // oxlint-disable-next-line react/no-array-index-key -- a card always has the same four corners
                              key={corner}
                              cx={point.x}
                              cy={point.y}
                              r={handle}
                              strokeWidth={stroke / 2}
                              className={cn(
                                "stroke-foreground cursor-move",
                                corner === 0 ? "fill-destructive" : "fill-background",
                              )}
                              onPointerDown={(event) => startDrag(event, card, corner)}
                            />
                          ))}
                        </g>
                      ))}
                    </svg>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => {
                        if (menuCard !== null) {
                          update(removeCard(label, menuCard));
                          setSelected(null);
                          setMenuCard(null);
                        }
                      }}
                    >
                      Delete card
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
