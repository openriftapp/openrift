import { labelMapOf } from "@openrift/shared/enum-label";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { helpArticleList } from "@/features/marketing/components/articles";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useQuery: () => ({ data: undefined }),
}));

vi.mock("@/features/cards/components/card-text", () => ({
  CardText: () => <span>card text</span>,
}));

function renderArticle(Article: ComponentType) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Article />
    </QueryClientProvider>,
  );
}

vi.mock("@/hooks/use-enums", async () => {
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return {
    useZoneOrder: useZoneOrderStub,
    useDeckFormatList: () => ({ labels: labelMapOf({ constructed: "Constructed" }) }),
    useEnumOrders: () => ({
      labels: {
        domains: labelMapOf({ fury: "Fury (admin)", calm: "Calm (admin)" }),
        finishes: labelMapOf({ foil: "Foil", normal: "Normal" }),
        rarities: labelMapOf({ common: "Common" }),
        cardTypes: labelMapOf({ rune: "Rune" }),
        superTypes: labelMapOf({ basic: "Basic" }),
        artVariants: labelMapOf({ altart: "Alt Art" }),
        conditions: labelMapOf({ "near-mint": "Near Mint" }),
      },
    }),
  };
});

const articles = await Promise.all(
  helpArticleList.map(async (article) => {
    const module = await article.component();
    return [article.slug, module.default] as const;
  }),
);

describe("help articles", () => {
  it.each(articles)("%s renders", (_slug, Article: ComponentType) => {
    const { container } = renderArticle(Article);

    expect(container.textContent).not.toBe("");
  });

  it("names the domains with the admin labels", () => {
    const HowToPlay = articles.find(([slug]) => slug === "how-to-play")?.[1];
    if (!HowToPlay) {
      throw new Error("how-to-play article missing");
    }
    renderArticle(HowToPlay);

    expect(screen.getByText("Fury (admin)")).toBeTruthy();
    expect(screen.getByText("Calm (admin)")).toBeTruthy();
  });

  it("documents the server link command of the Discord bot", () => {
    const DiscordBot = articles.find(([slug]) => slug === "discord-bot")?.[1];
    if (!DiscordBot) {
      throw new Error("discord-bot article missing");
    }
    renderArticle(DiscordBot);

    expect(screen.getByRole("heading", { name: "Show group tradelists with /link" })).toBeTruthy();
    expect(screen.getByText("/link code:…")).toBeTruthy();
  });
});
