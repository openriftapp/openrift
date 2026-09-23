import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BeforeInstallPromptEvent } from "@/stores/install-store";
import { useInstallStore } from "@/stores/install-store";
import { createStoreResetter } from "@/test/store-helpers";

import { InstallPage } from "./install-page";

const IPHONE_SAFARI_26 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.0.0";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function useUserAgent(userAgent: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
}

describe("InstallPage", () => {
  let resetStore: () => void;

  beforeEach(() => {
    resetStore = createStoreResetter(useInstallStore);
  });

  afterEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  it("walks an iPhone through Safari's share sheet", () => {
    useUserAgent(IPHONE_SAFARI_26);
    render(<InstallPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Put OpenRift on your home screen",
    );
    expect(screen.getByText("iPhone · Safari")).toBeInTheDocument();
    expect(screen.getByText("Open as Web App")).toBeInTheDocument();
    expect(screen.getByText("Start here")).toBeInTheDocument();
  });

  it("offers one-tap install on Android once the browser allows it", async () => {
    const user = userEvent.setup();
    useUserAgent(ANDROID_CHROME);
    const prompt = vi.fn(async () => {});
    useInstallStore.getState().setPromptEvent(
      Object.assign(new Event("beforeinstallprompt"), {
        prompt,
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      }) as BeforeInstallPromptEvent,
    );
    render(<InstallPage />);

    await user.click(screen.getByRole("button", { name: "Install OpenRift" }));

    expect(prompt).toHaveBeenCalledOnce();
  });

  it("shows the menu steps on Android without the install button when no prompt arrived", () => {
    useUserAgent(ANDROID_CHROME);
    render(<InstallPage />);

    expect(screen.queryByRole("button", { name: "Install OpenRift" })).toBeNull();
    expect(screen.getByText("Add to home screen")).toBeInTheDocument();
  });

  it("sends in-app browsers to Safari first", () => {
    useUserAgent(IPHONE_INSTAGRAM);
    render(<InstallPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Open this page in Safari first",
    );
    expect(screen.getByRole("link", { name: "Open in Safari" }).getAttribute("href")).toMatch(
      /^x-safari-https?:\/\//u,
    );
  });

  it("lets the visitor switch to the other phone's steps", async () => {
    const user = userEvent.setup();
    useUserAgent(IPHONE_SAFARI_26);
    render(<InstallPage />);

    await user.click(screen.getByRole("button", { name: "Not your device?" }));
    await user.click(screen.getByRole("tab", { name: "Android" }));

    expect(screen.getByText("Add to home screen")).toBeInTheDocument();
    expect(screen.queryByText("Start here")).toBeNull();
  });

  it("shows a QR code and both phones' steps on a computer", () => {
    useUserAgent(WINDOWS_CHROME);
    render(<InstallPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Get OpenRift on your phone",
    );
    expect(screen.getByRole("img", { name: "QR code for this page" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "iPhone" })).toBeInTheDocument();
  });
});
