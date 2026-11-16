import type { QueryClient } from "@tanstack/react-query";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { rulesKeys } from "./rules-query-keys";
import { loadRulesVersion } from "./rules-version-loader";

const VERSION = "2026-10-09";

function fakeQueryClient(rules: { infraction?: object }[]): QueryClient {
  return {
    query: vi.fn(({ queryKey }: { queryKey: readonly unknown[] }) =>
      Promise.resolve(
        queryKey.at(-1) === "versions"
          ? {
              versions: [
                { version: VERSION, documentVersion: null, label: null, languages: ["en", "ko"] },
              ],
              languages: ["en", "ko"],
            }
          : { rules },
      ),
    ),
  } as unknown as QueryClient;
}

const MARKED = [{}, { infraction: { penalties: ["Warning"], stated: true } }];

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("loadRulesVersion", () => {
  it("loads the infractions view of a version that has infractions", async () => {
    const queryClient = fakeQueryClient(MARKED);
    const data = await loadRulesVersion({
      queryClient,
      kind: "tournament",
      version: VERSION,
      search: { lang: "ko" },
      hash: "",
      view: "infractions",
    });
    expect(data).toEqual({
      kind: "tournament",
      language: "ko",
      version: VERSION,
      versionLabel: VERSION,
      languages: ["en", "ko"],
    });
    expect(queryClient.query).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: rulesKeys.byVersion("tournament", "ko", VERSION) }),
    );
  });

  it("has no infractions view for the core rules", async () => {
    const thrown = await thrownBy(
      loadRulesVersion({
        queryClient: fakeQueryClient(MARKED),
        kind: "core",
        version: VERSION,
        search: { lang: "en" },
        hash: "",
        view: "infractions",
      }),
    );
    expect(isNotFound(thrown)).toBe(true);
  });

  it("has no infractions view for a version without infractions", async () => {
    const thrown = await thrownBy(
      loadRulesVersion({
        queryClient: fakeQueryClient([{}]),
        kind: "tournament",
        version: VERSION,
        search: { lang: "en" },
        hash: "",
        view: "infractions",
      }),
    );
    expect(isNotFound(thrown)).toBe(true);
  });

  it("redirects a language the version lacks to English, staying in the infractions view", async () => {
    const thrown = await thrownBy(
      loadRulesVersion({
        queryClient: fakeQueryClient(MARKED),
        kind: "tournament",
        version: VERSION,
        search: { lang: "fr", q: "trigger", penalty: "warning" },
        hash: "rule-702.2",
        view: "infractions",
      }),
    );
    expect(isRedirect(thrown)).toBe(true);
    const { options } = thrown as { options: Record<string, unknown> };
    expect(options).toMatchObject({
      to: "/rules/$kind/$version/infractions",
      params: { kind: "tournament", version: VERSION },
      search: { q: "trigger", lang: "en", penalty: "warning" },
      hash: "rule-702.2",
      replace: true,
    });
  });

  it("rejects an unknown rulebook", async () => {
    const thrown = await thrownBy(
      loadRulesVersion({
        queryClient: fakeQueryClient(MARKED),
        kind: "glossary",
        version: VERSION,
        search: { lang: "en" },
        hash: "",
        view: "document",
      }),
    );
    expect(isNotFound(thrown)).toBe(true);
  });
});
