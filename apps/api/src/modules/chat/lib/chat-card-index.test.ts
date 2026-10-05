import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { createChatCardIndexLoader } from "./chat-card-index.js";

function makeRepos() {
  const enums = {
    all: vi.fn(async () => ({
      cardTypes: [{ slug: "unit", label: "Unit" }],
      superTypes: [{ slug: "champion", label: "Champion" }],
      domains: [{ slug: "fury", label: "Fury" }],
    })),
    contentVersion: vi.fn(async () => "enums-v1"),
  };
  const catalog = {
    cards: vi.fn(async () => []),
    printingCodes: vi.fn(async () => []),
    nameAliases: vi.fn(async () => []),
    catalogContentVersion: vi.fn(async () => "catalog-v1"),
  };
  return { repos: { enums, catalog } as unknown as Repos, enums, catalog };
}

describe("createChatCardIndexLoader", () => {
  it("builds the stat labels from the enum tables", async () => {
    const { repos } = makeRepos();
    const { labels } = await createChatCardIndexLoader(repos)();
    expect(labels).toEqual({
      cardTypes: { unit: "Unit" },
      superTypes: { champion: "Champion" },
      domains: { fury: "Fury" },
    });
  });

  it("reuses both loads while the content versions are unchanged", async () => {
    const { repos, enums, catalog } = makeRepos();
    const load = createChatCardIndexLoader(repos);
    await load();
    await load();
    expect(enums.all).toHaveBeenCalledTimes(1);
    expect(catalog.cards).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the labels when the enum version changes", async () => {
    const { repos, enums } = makeRepos();
    const load = createChatCardIndexLoader(repos);
    await load();
    enums.contentVersion.mockResolvedValue("enums-v2");
    await load();
    expect(enums.all).toHaveBeenCalledTimes(2);
  });
});
