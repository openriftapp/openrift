export const DEVELOPER_ENDPOINT_PATHS = [
  "/api/v1/catalog",
  "/api/v1/cards/{cardSlug}",
  "/api/v1/sets",
  "/api/v1/prices",
  "/api/v1/prices/{printingId}",
  "/api/v1/prices/links",
  "/api/v1/rules",
  "/api/v1/rules/versions",
] as const;

export type DeveloperEndpointPath = (typeof DEVELOPER_ENDPOINT_PATHS)[number];
