import { createContext, use, useEffect, useRef, useState } from "react";

import type { PlaceholderField } from "@/features/cards/lib/card-placeholder-regions";

/** Each request is a new object, so asking for the same field twice still registers. */
export interface FieldFocusRequest {
  field: PlaceholderField;
}

interface FieldFocusValue {
  active: PlaceholderField | null;
  setActive: (field: PlaceholderField | null) => void;
  request: FieldFocusRequest | null;
  requestFocus: (field: PlaceholderField) => void;
  settleRequest: (request: FieldFocusRequest) => void;
}

const FieldFocusContext = createContext<FieldFocusValue | null>(null);

function useFieldFocus(): FieldFocusValue | null {
  return use(FieldFocusContext);
}

export function useFieldFocusState(): FieldFocusValue {
  const [active, setActive] = useState<PlaceholderField | null>(null);
  const [request, setRequest] = useState<FieldFocusRequest | null>(null);
  return {
    active,
    setActive,
    request,
    requestFocus: (field) => setRequest({ field }),
    settleRequest: (settled) => setRequest((current) => (current === settled ? null : current)),
  };
}

export function FieldFocusProvider({
  value,
  children,
}: {
  value: FieldFocusValue;
  children: React.ReactNode;
}) {
  return <FieldFocusContext value={value}>{children}</FieldFocusContext>;
}

interface FieldLinkProps {
  ref?: React.RefObject<HTMLDivElement | null>;
  "data-field"?: PlaceholderField;
  "data-linked-active"?: true;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocusCapture?: () => void;
  onBlurCapture?: () => void;
}

/**
 * Spread onto the control a linked row's jump focuses. Each row marks exactly one; the row's other
 * controls (pickers, hint triggers, hidden inputs) are never focused by a jump.
 */
export const FIELD_CONTROL = { "data-field-control": true } as const;

/**
 * Links a form row to its preview region. When a focus request names its field, the row scrolls into
 * view and focuses its `FIELD_CONTROL` element, on mount if the request opened the section holding it.
 */
export function useFieldLink(field?: PlaceholderField): {
  props: FieldLinkProps;
  active: boolean;
} {
  const focus = useFieldFocus();
  const ref = useRef<HTMLDivElement>(null);
  const request = focus?.request ?? null;
  const settleRequest = focus?.settleRequest;

  useEffect(() => {
    const row = ref.current;
    if (request === null || request.field !== field || row === null) {
      return;
    }
    focusRowControl(row);
    settleRequest?.(request);
  }, [request, field, settleRequest]);

  if (field === undefined || focus === null) {
    return { props: {}, active: false };
  }
  const active = focus.active === field;
  return {
    active,
    props: {
      ref,
      "data-field": field,
      "data-linked-active": active || undefined,
      onPointerEnter: () => focus.setActive(field),
      onPointerLeave: () => focus.setActive(null),
      onFocusCapture: () => focus.setActive(field),
      onBlurCapture: () => focus.setActive(null),
    },
  };
}

function focusRowControl(row: HTMLElement) {
  row.scrollIntoView?.({ block: "center", behavior: "smooth" });
  row.querySelector<HTMLElement>("[data-field-control]")?.focus();
}
