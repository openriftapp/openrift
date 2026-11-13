import { createLazyFileRoute } from "@tanstack/react-router";

import { MySubmissionsPage } from "@/features/contribute/components/my-submissions-page";

export const Route = createLazyFileRoute("/_app/_authenticated/contribute_/submissions")({
  component: MySubmissionsPage,
});
