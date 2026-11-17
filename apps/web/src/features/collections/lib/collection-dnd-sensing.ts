import type {
  Activators,
  CollisionDetection,
  KeyboardCodes,
  KeyboardSensorOptions,
  KeyboardSensorProps,
  SensorInstance,
} from "@dnd-kit/core";
import {
  closestCenter,
  defaultKeyboardCoordinateGetter,
  KeyboardCode,
  KeyboardSensor,
  pointerWithin,
} from "@dnd-kit/core";

import type {
  CollectionDragData,
  SidebarReorderCollectionDragData,
  SidebarReorderListDragData,
} from "@/features/collections/lib/dnd-types";
import { SIDEBAR_REORDER_DRAG_TYPES } from "@/features/collections/lib/dnd-types";
import { asDragData } from "@/lib/dnd-data";

const sidebarReorderActivators: Activators<KeyboardSensorOptions> = KeyboardSensor.activators.map(
  ({ eventName, handler }) => ({
    eventName,
    handler: (event, options, context) =>
      asDragData<CollectionDragData>(context.active.data.current, SIDEBAR_REORDER_DRAG_TYPES) !==
        undefined && handler(event, options, context),
  }),
);

const DEFAULT_KEYBOARD_CODES: KeyboardCodes = {
  start: [KeyboardCode.Space, KeyboardCode.Enter],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab],
};

// Reorder grips only: card tiles have no activator node. Never scrolls, since KeyboardSensor's
// page scroll toward a row above mid-viewport leaves the sticky sidebar's rows where they are.
export class SidebarReorderKeyboardSensor implements SensorInstance {
  static activators = sidebarReorderActivators;

  autoScrollEnabled = false;
  private readonly props: KeyboardSensorProps;
  private readonly ownerDocument: Document;
  private origin: Parameters<KeyboardSensorProps["onMove"]>[0] | undefined;

  constructor(props: KeyboardSensorProps) {
    this.props = props;
    const target = props.event.target;
    this.ownerDocument =
      target instanceof Node && target.ownerDocument ? target.ownerDocument : document;
    this.ownerDocument.addEventListener("keydown", this.handleKeyDown);
    this.ownerDocument.addEventListener("visibilitychange", this.handleCancel);
    window.addEventListener("resize", this.handleCancel);
    props.onStart({ x: 0, y: 0 });
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event === this.props.event) {
      return;
    }
    const { active, context, options } = this.props;
    const codes = options.keyboardCodes ?? DEFAULT_KEYBOARD_CODES;
    if (codes.end.includes(event.code)) {
      event.preventDefault();
      this.detach();
      this.props.onEnd();
      return;
    }
    if (codes.cancel.includes(event.code)) {
      this.handleCancel(event);
      return;
    }
    const { collisionRect } = context.current;
    const current = collisionRect
      ? { x: collisionRect.left, y: collisionRect.top }
      : { x: 0, y: 0 };
    this.origin ??= current;
    const getCoordinates = options.coordinateGetter ?? defaultKeyboardCoordinateGetter;
    const next = getCoordinates(event, {
      active,
      context: context.current,
      currentCoordinates: current,
    });
    if (next) {
      event.preventDefault();
      this.props.onMove({ x: next.x - this.origin.x, y: next.y - this.origin.y });
    }
  };

  private readonly handleCancel = (event: Event) => {
    event.preventDefault();
    this.detach();
    this.props.onCancel();
  };

  private detach() {
    this.ownerDocument.removeEventListener("keydown", this.handleKeyDown);
    this.ownerDocument.removeEventListener("visibilitychange", this.handleCancel);
    window.removeEventListener("resize", this.handleCancel);
  }
}

/** A keyboard drag has no pointer, so it lands on the closest droppable. */
export const collectionCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

/** A sidebar row takes a reorder drop only from its own section: collections, or lists of one intent. */
export function acceptsReorderDrop(
  row: SidebarReorderCollectionDragData | SidebarReorderListDragData,
  activeData: unknown,
): boolean {
  const active = asDragData<CollectionDragData>(activeData, SIDEBAR_REORDER_DRAG_TYPES);
  if (active?.type === "sidebar-reorder-list") {
    return row.type === "sidebar-reorder-list" && row.intent === active.intent;
  }
  return active?.type === row.type;
}
