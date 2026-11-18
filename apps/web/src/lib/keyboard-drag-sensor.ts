import type { KeyboardCodes, KeyboardSensorProps, SensorInstance } from "@dnd-kit/core";
import { defaultKeyboardCoordinateGetter, KeyboardCode, KeyboardSensor } from "@dnd-kit/core";

const DEFAULT_KEYBOARD_CODES: KeyboardCodes = {
  start: [KeyboardCode.Space, KeyboardCode.Enter],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab],
};

export interface KeyboardDragMove {
  areas: readonly Element[];
  page: Element | null;
  top: number;
  bottom: number;
  deltaY: number;
}

/**
 * A keyboard drag sensor that never scrolls the page: `KeyboardSensor` scrolls the page toward a row above
 * mid-viewport, which leaves the rows of a sticky container where they are.
 */
export class NonScrollingKeyboardSensor implements SensorInstance {
  static activators = KeyboardSensor.activators;

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
      const scrolled = this.scrollForMove({
        areas: context.current.scrollableAncestors,
        page: this.ownerDocument.scrollingElement,
        top: next.y,
        bottom: next.y + (collisionRect?.height ?? 0),
        deltaY: next.y - current.y,
      });
      this.props.onMove({ x: next.x - this.origin.x, y: next.y - this.origin.y - scrolled });
    }
  };

  /** Returns the distance a subclass scrolled to keep the moved row in view. */
  protected scrollForMove(_move: KeyboardDragMove): number {
    return 0;
  }

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
