import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod/mini";

import { lenient } from "@/lib/lenient-param";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/listings")({
  validateSearch: z.object({ q: lenient(z.string()) }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/admin/workspace/cards", search: { q: search.q, queue: "listings" } });
  },
});
