import type { ComponentProps } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useHydrated } from "@/hooks/use-hydrated";
import { m } from "@/paraglide/messages.js";

type TextControl = HTMLInputElement | HTMLTextAreaElement;

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "file",
  "hidden",
  "image",
  "radio",
  "reset",
  "submit",
]);

function divergedControls(form: HTMLFormElement) {
  return [...form.elements]
    .filter(
      (element): element is TextControl =>
        element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(element.type)),
    )
    .filter((control) => control.value !== control.defaultValue)
    .map((control) => ({
      control,
      value: control.value,
      focused: control === document.activeElement,
      selectionStart: control.selectionStart,
      selectionEnd: control.selectionEnd,
      selectionDirection: control.selectionDirection ?? undefined,
    }));
}

function adoptDomValues(controls: ReturnType<typeof divergedControls>) {
  for (const diverged of controls) {
    const { control, value, selectionStart, selectionEnd } = diverged;
    const setValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), "value")?.set;
    if (!setValue) {
      continue;
    }
    // React drops an input event whose value its tracker already holds; the own-property
    // setter records the rendered value, the prototype setter then bypasses the tracker.
    control.value = control.defaultValue;
    setValue.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    if (diverged.focused && selectionStart !== null && selectionEnd !== null) {
      control.setSelectionRange(selectionStart, selectionEnd, diverged.selectionDirection);
    }
  }
}

function discardDomValues(form: HTMLFormElement) {
  for (const { control } of divergedControls(form)) {
    control.value = control.defaultValue;
  }
}

/**
 * Before hydration the browser submits natively: `post` keeps the fields out of the URL,
 * and the page route renders without reading the body.
 */
export function AccountForm({
  onSubmit,
  earlyInput = "keep",
  children,
  ...props
}: Omit<ComponentProps<"form">, "method" | "action" | "ref"> & {
  earlyInput?: "keep" | "discard";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef(onSubmit);

  useLayoutEffect(() => {
    submitRef.current = onSubmit;
  });

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    if (earlyInput === "discard") {
      discardDomValues(form);
    } else {
      // Inside a passive effect React restores the old value before committing the new one.
      const controls = divergedControls(form);
      queueMicrotask(() => adoptDomValues(controls));
    }
  }, [earlyInput]);

  return (
    <form
      noValidate
      {...props}
      ref={formRef}
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        flushSync(() => adoptDomValues(divergedControls(form)));
        submitRef.current?.(event);
      }}
    >
      <noscript>
        <FieldError>{m.auth_needs_javascript()}</FieldError>
      </noscript>
      {children}
    </form>
  );
}

/** Button drops `disabled` from server HTML, so a native fieldset blocks the pre-hydration submit. */
export function AccountFormSubmit(props: Omit<ComponentProps<typeof Button>, "type">) {
  const hydrated = useHydrated();
  return (
    <fieldset disabled={!hydrated} className="contents">
      <Button {...props} type="submit" />
    </fieldset>
  );
}
