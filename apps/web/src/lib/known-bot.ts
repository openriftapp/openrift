const KNOWN_BOT_PATTERN =
  /googlebot|google-inspectiontool|adsbot-google|bingbot|applebot|duckduckbot|yandexbot|baiduspider|meta-externalagent|meta-externalfetcher|facebookexternalhit|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|perplexitybot|bytespider|amazonbot|ccbot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot/iu;

const BOT_BLOCKED_PATH_PATTERN =
  /^\/(?:login|signup|reset-password|verify-email|meta\/submit|meta\/[^/]+\/submit)\/?$/u;

export function isKnownBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    return false;
  }
  return KNOWN_BOT_PATTERN.test(userAgent);
}

export function isBotBlockedPath(pathname: string): boolean {
  return BOT_BLOCKED_PATH_PATTERN.test(pathname);
}

export function botBlockedResponse(request: Request): Response | null {
  if (!isBotBlockedPath(new URL(request.url).pathname)) {
    return null;
  }
  if (!isKnownBot(request.headers.get("user-agent"))) {
    return null;
  }
  return new Response("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
