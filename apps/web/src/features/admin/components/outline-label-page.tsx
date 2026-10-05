import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import type {
  FrameOutlineLabel,
  FrameOutlineLabels,
  OutlineLabelPoint,
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
  moveCorner,
  removeCard,
  serializeOutlineLabels,
  serializeStoredOutlineLabels,
  storedOutlineLabelsFor,
} from "@/features/admin/lib/outline-labels";
import { downloadText } from "@/lib/download";
import { cn, PAGE_WIDTH } from "@/lib/utils";

const EMPTY_LABEL: FrameOutlineLabel = { cards: [], done: false };

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
  const dragRef = useRef<{ card: number; corner: number } | null>(null);
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

  function toImage(event: ReactPointerEvent<SVGSVGElement>): OutlineLabelPoint | null {
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
    update(moveCorner(label, drag.card, drag.corner, point));
  }

  function startDrag(event: ReactPointerEvent<SVGElement>, card: number, corner: number): void {
    event.stopPropagation();
    dragRef.current = { card, corner };
    setSelected(card);
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

  function add(): void {
    if (size) {
      update(addCard(label, size.width, size.height));
      setSelected(label.cards.length);
    }
  }

  function remove(): void {
    if (selected !== null) {
      update(removeCard(label, selected));
      setSelected(null);
    }
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
    } else if (event.key === "a") {
      add();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      remove();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    globalThis.addEventListener("keydown", listener);
    return () => globalThis.removeEventListener("keydown", listener);
  }, []);

  const handle = size ? Math.max(6, size.width * 0.012) : 6;
  const stroke = size ? Math.max(2, size.width * 0.003) : 2;

  return (
    <>
      <AdminPageTopBar title="Outline Labels" />
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-4 pb-12")}>
        <PageDescription>
          Open the frame folder: every image plus proposals.json, and a saved scan-labels.json to
          continue. Drag each corner onto the card&apos;s outer edge, add cards that have no
          outline, remove outlines that are not a card, then mark the frame done. A frame counts for
          training only once every card in it is outlined. Keys: n and p move between frames, d
          marks done, a adds a card, Delete removes the selected one.
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
              <Button variant="outline" onClick={add} disabled={!size}>
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
              <span className="text-muted-foreground text-sm">
                {frame.name}: frame {current + 1} of {frames.length}, {doneCount(labels)} done
              </span>
            </div>
            <div>
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
                <svg
                  ref={svgRef}
                  viewBox={`${-margin} ${-margin} ${size.width + 2 * margin} ${size.height + 2 * margin}`}
                  className="bg-muted block touch-none"
                  style={{
                    aspectRatio: `${size.width + 2 * margin} / ${size.height + 2 * margin}`,
                    width: `min(100%, calc(75vh * ${(size.width + 2 * margin) / (size.height + 2 * margin)}))`,
                  }}
                  role="application"
                  aria-label="Card outlines"
                  onPointerMove={handleMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
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
                        className={
                          selected === card
                            ? "fill-warning-soft stroke-warning"
                            : "fill-success-soft stroke-success"
                        }
                        strokeWidth={stroke}
                        onPointerDown={() => setSelected(card)}
                      />
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
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
