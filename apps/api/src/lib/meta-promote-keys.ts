export function eventPromoteKey(eventId: string): string {
  return `event:${eventId}`;
}

export function sourcePromoteKey(provider: string, externalId: string): string {
  return `source:${provider}:${externalId}`;
}
