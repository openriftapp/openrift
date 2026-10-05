import { createLazyFileRoute } from "@tanstack/react-router";

import { ProfilePage } from "@/features/account/components/profile-page";

export const Route = createLazyFileRoute("/_app/_authenticated/profile")({
  component: ProfilePage,
});
