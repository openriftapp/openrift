import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AccountForm, AccountFormSubmit } from "./account-form";

function SignInFields({ onSubmit }: { onSubmit?: () => void }) {
  return (
    <AccountForm aria-label="Sign in" onSubmit={onSubmit}>
      <input name="email" type="email" defaultValue="viktor@example.com" />
      <input name="password" type="password" defaultValue="hextech-secret" />
      <AccountFormSubmit>Sign in</AccountFormSubmit>
    </AccountForm>
  );
}

function nativeSubmitUrl(form: HTMLFormElement): string {
  const action = new URL(form.action || globalThis.location.href);
  if (form.method !== "get") {
    return action.href;
  }
  const fields = new URLSearchParams(
    [...new FormData(form).entries()].map(([key, value]) => [
      key,
      typeof value === "string" ? value : value.name,
    ]),
  );
  return `${action.origin}${action.pathname}?${fields.toString()}`;
}

describe("AccountForm", () => {
  it("posts and blocks its submit button in the server HTML", () => {
    const html = renderToString(<SignInFields />);

    expect(html).toMatch(/<form[^>]*method="post"/u);
    expect(html).not.toMatch(/<form[^>]*action=/u);
    expect(html).toMatch(/<fieldset[^>]*disabled=""[^>]*>\s*<button[^>]*type="submit"/u);
  });

  it("tells a visitor without JavaScript why the form cannot be sent", () => {
    const html = renderToString(<SignInFields />);

    expect(html).toMatch(/<noscript>.*This form needs JavaScript/su);
  });

  it("keeps the fields out of the URL a native submit would load", () => {
    render(<SignInFields />);
    const form = screen.getByRole("form", { name: "Sign in" }) as HTMLFormElement;

    const url = nativeSubmitUrl(form);

    expect(url).not.toContain("password");
    expect(url).not.toContain("hextech-secret");
    expect(url).not.toContain("viktor");
  });

  it("enables submit after hydration and never lets the browser navigate", () => {
    const onSubmit = vi.fn();
    render(<SignInFields onSubmit={onSubmit} />);
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toBeEnabled();

    const event = new Event("submit", { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole("form", { name: "Sign in" }), event);

    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("is the only form element in the account components", () => {
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const offenders = readdirSync(dir)
      .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
      .filter((file) => file !== "account-form.tsx")
      .filter((file) => /<form[\s>]/u.test(readFileSync(path.join(dir, file), "utf-8")));

    expect(offenders).toEqual([]);
  });
});
