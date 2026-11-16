import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const withCookies = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const cookie = request.headers.get("cookie") ?? "";
  return next({ context: { cookie } });
});
