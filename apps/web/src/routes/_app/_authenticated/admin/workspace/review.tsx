import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod/mini";

import { lenient } from "@/lib/lenient-param";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/review")({
  validateSearch: z.object({ q: lenient(z.string()), only: lenient(z.enum(["ready"])) }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/admin/workspace/cards",
      search: { q: search.q, queue: search.only === "ready" ? "ready" : "review" },
    });
  },
});
