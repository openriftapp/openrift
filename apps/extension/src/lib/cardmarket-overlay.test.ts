import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OverlayContext, PageState } from "./cardmarket-overlay";
import { installOverlay } from "./cardmarket-overlay";
import { WIZARD_SELLER } from "./cardmarket-wizard";
import type { OverlaySnapshot } from "./overlay-snapshot";
import { emptyBasket, pickedQuantity } from "./picks";

const fake = vi.hoisted(() => ({
  browser: {
    runtime: { id: "extension-id" as string | undefined },
    storage: {
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      local: { set: vi.fn(async () => {}) },
    },
  },
}));

vi.mock("wxt/browser", () => ({ browser: fake.browser }));

const SNAPSHOT: OverlaySnapshot = {
  lists: [{ id: "0199a0f2-0000-7000-8000-000000000001", name: "Summoner Skirmish wants" }],
  generatedAt: "2026-09-09T11:00:00.000Z",
  capturedAt: "2026-09-09T11:00:00.000Z",
  products: { "866920:foil": { owned: 0, wanted: 5, cardtraderCents: 20 } },
};

const UNDERTITAN = {
  idProduct: 866_920,
  finish: "foil",
  idLanguage: 1,
  languageLabel: "English",
  productName: "Undertitan",
} as const;

const OFFERS_ROW = `<div id="stockRow1" class="article-row"><span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/SFD/866920/866920.jpg&quot;&gt;"></span><div class="col-seller"><a href="/de/Riftbound/Products/Singles/x">Undertitan</a></div><span class="icon" aria-label="English"></span></div>`;

function wizardCard(id: string, quantity: number): string {
  return `<div id="${id}" class="card detailed-result-card"><table><thead><tr><th>Price</th></tr></thead><tbody><tr><td><input type="checkbox" data-id-article="${id}"></td><td><span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/SFD/866920/866920.jpg&quot;&gt;"></span></td><td>${quantity}</td><td class="card-name">Undertitan</td><td><span class="icon" aria-label="English"></span></td><td><span class="extras"><span class="icon" aria-label="Foil"></span></span></td><td class="text-end">1,00 €</td></tr></tbody></table></div>`;
}

function offersState(): PageState {
  return {
    kind: "offers",
    seller: "summoner-shop",
    snapshot: undefined,
    basket: emptyBasket(),
    countZeroShipping: false,
  };
}

function plusButton(): HTMLElement {
  const button = document.querySelector<HTMLElement>('[data-openrift-pick-delta="1"]');
  if (button === null) {
    throw new Error("pick control missing");
  }
  return button;
}

// WXT's own context reads import.meta.env at import, which only a WXT build provides.
// This one keeps its contract: invalid once aborted or once the extension id is gone.
class FakeContext implements OverlayContext {
  readonly controller = new AbortController();

  get isInvalid(): boolean {
    if (fake.browser.runtime.id === undefined) {
      this.controller.abort();
    }
    return this.controller.signal.aborted;
  }

  onInvalidated(cb: () => void): () => void {
    this.controller.signal.addEventListener("abort", cb);
    return () => this.controller.signal.removeEventListener("abort", cb);
  }

  setTimeout(handler: () => void, timeout?: number): number {
    return Number(
      globalThis.setTimeout(() => {
        if (!this.isInvalid) {
          handler();
        }
      }, timeout),
    );
  }

  addEventListener(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, { ...options, signal: this.controller.signal });
  }
}

const contexts: FakeContext[] = [];

function context(): FakeContext {
  const ctx = new FakeContext();
  contexts.push(ctx);
  return ctx;
}

beforeEach(() => {
  fake.browser.runtime.id = "extension-id";
  vi.clearAllMocks();
});

afterEach(() => {
  for (const ctx of contexts.splice(0)) {
    ctx.controller.abort();
  }
  document.body.replaceChildren();
});

describe("installOverlay", () => {
  it("stores a pick from the page's own control", () => {
    document.body.innerHTML = OFFERS_ROW;
    const state = offersState();

    installOverlay(context(), state, document);
    plusButton().click();

    expect(pickedQuantity(state.basket, "summoner-shop", { ...UNDERTITAN, finish: "normal" })).toBe(
      1,
    );
    expect(fake.browser.storage.local.set).toHaveBeenCalledTimes(1);
  });

  it("reports rows read and cards resolved without a snapshot", () => {
    document.body.innerHTML = OFFERS_ROW + OFFERS_ROW.replace("product-images.s3", "elsewhere");

    expect(installOverlay(context(), offersState(), document)).toEqual({ rows: 2, resolved: 1 });
  });

  it("lets go of the page once its context is invalidated by a newer injection", () => {
    document.body.innerHTML = OFFERS_ROW;
    const older = offersState();
    const ctx = context();
    installOverlay(ctx, older, document);
    const listener = fake.browser.storage.onChanged.addListener.mock.calls[0]?.[0];

    ctx.controller.abort();
    plusButton().click();

    expect(fake.browser.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
    expect(older.basket).toEqual(emptyBasket());
    expect(fake.browser.storage.local.set).not.toHaveBeenCalled();
  });

  it("tears itself down once the extension behind it is gone", () => {
    document.body.innerHTML = OFFERS_ROW;
    const state = offersState();
    installOverlay(context(), state, document);

    fake.browser.runtime.id = undefined;
    plusButton().click();
    plusButton().click();

    expect(state.basket).toEqual(emptyBasket());
    expect(fake.browser.storage.local.set).not.toHaveBeenCalled();
    expect(fake.browser.storage.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });

  it("picks a product split across two wizard sellers at the sum of both", () => {
    document.body.innerHTML = `<div id="ShoppingWizardResult"></div>${wizardCard("DetailedResult1", 2)}${wizardCard("DetailedResult2", 3)}`;
    const state: PageState = {
      kind: "wizard",
      seller: WIZARD_SELLER,
      snapshot: SNAPSHOT,
      basket: emptyBasket(),
      countZeroShipping: false,
    };

    installOverlay(context(), state, document);
    document.querySelector<HTMLElement>("[data-openrift-wizard-pick]")?.click();

    expect(pickedQuantity(state.basket, WIZARD_SELLER, UNDERTITAN)).toBe(5);
  });
});
