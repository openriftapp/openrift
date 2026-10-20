import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_app/_authenticated/admin/printing-desk_/printings/$printingId",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/printings/$printingId",
      params: { printingId: params.printingId },
      replace: true,
    });
  },
});
