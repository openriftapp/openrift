import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/roadmap")({
  loader: () => {
    throw redirect({ to: "/changelog", search: { show: "milestones" }, replace: true });
  },
});
