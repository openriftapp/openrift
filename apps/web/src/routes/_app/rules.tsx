import { createFileRoute, redirect } from "@tanstack/react-router";

import { rulesSearchSchema } from "@/features/rules/lib/rules-search-schema";

export const Route = createFileRoute("/_app/rules")({
  validateSearch: rulesSearchSchema,
  beforeLoad: ({ location, search }) => {
    throw redirect({
      to: "/rules/$kind",
      params: { kind: "core" },
      search: { q: search.q, lang: search.lang },
      hash: location.hash || undefined,
      replace: true,
    });
  },
});
