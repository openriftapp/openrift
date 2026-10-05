import { createLazyFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/scan-bench")({
  // A static import would put the bench in the production bundle.
  component: import.meta.env.DEV
    ? lazyRouteComponent(
        () => import("@/features/admin/components/scan-bench-page"),
        "ScanBenchPage",
      )
    : () => null,
});
