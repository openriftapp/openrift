import { createFileRoute } from "@tanstack/react-router";

// No component: the parent scan page owns the camera and stays mounted across
// both routes; this route only drops the app frame while the camera screen is up.
export const Route = createFileRoute("/_app/scan/camera")({
  staticData: { chrome: "bare" },
});
