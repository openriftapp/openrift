import { createLazyFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/outline-labels")({
  // A static import would put the labelling page in the production bundle.
  component: import.meta.env.DEV
    ? lazyRouteComponent(
        () => import("@/features/admin/components/outline-label-page"),
        "OutlineLabelPage",
      )
    : () => null,
});
