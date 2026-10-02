import { createFileRoute, redirect } from "@tanstack/react-router";

import { rulesSearchSchema } from "@/features/rules/lib/rules-search-schema";

export const Route = createFileRoute("/_app/rules")({
  validateSearch: rulesSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q, lang: search.lang }),
  loader: ({ location, deps }) => {
    throw redirect({
      to: "/rules/$kind",
      params: { kind: "core" },
      search: deps,
      hash: location.hash || undefined,
      replace: true,
    });
  },
});
