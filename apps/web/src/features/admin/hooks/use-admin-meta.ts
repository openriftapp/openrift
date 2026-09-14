import { adminMetaContract } from "@openrift/shared/contracts/admin/meta";
import type { AdminMetaEventList, AdminMetaEventSource } from "@openrift/shared/types/api/meta";
import type { DeckZone, MetaListStatus } from "@openrift/shared/types/enums";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import type { AdminMetaEventQueryParams } from "@/features/admin/lib/admin-meta-queries";
import {
  adminMetaEventPlayersQueryOptions,
  adminMetaEventQueryOptions,
  adminMetaEventsQueryOptions,
  META_EVENT_SORT_FALLBACK,
} from "@/features/admin/lib/admin-meta-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { metaKeys } from "@/features/meta/lib/meta-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

interface MetaDeckCardInput {
  cardId: string;
  zone: DeckZone;
  quantity: number;
  preferredPrintingId?: string | null;
}

export interface MetaPlayerListInput {
  name: string;
  format: string;
  formatConfig?: Record<string, unknown> | null;
  cards: MetaDeckCardInput[];
  listStatus?: Exclude<MetaListStatus, "none">;
}

export type MetaEventInput = ContractInput<typeof adminMetaContract, "createEvent">;

export function useAdminMetaEvents(params: AdminMetaEventQueryParams) {
  return useSuspenseQuery(adminMetaEventsQueryOptions(params));
}

const searchMetaEvents = createServerFn({ method: "GET" })
  .validator((search: string) => search)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<AdminMetaEventList> =>
    apiOrpcClient(adminMetaContract, context.cookie).listEvents({
      search: data === "" ? undefined : data,
      limit: 8,
      sort: META_EVENT_SORT_FALLBACK.sort,
      direction: META_EVENT_SORT_FALLBACK.direction,
    }),
  );

export function useMetaEventSearch(search: string) {
  return useQuery({
    queryKey: adminKeys.meta.eventSearch(search),
    queryFn: () => searchMetaEvents({ data: search }),
    staleTime: 60 * 1000,
  });
}

export function useAdminMetaEvent(eventId: string) {
  return useSuspenseQuery(adminMetaEventQueryOptions(eventId));
}

export function useAdminMetaLinkedEvent(eventId: string | null) {
  return useQuery({ ...adminMetaEventQueryOptions(eventId ?? ""), enabled: eventId !== null });
}

const createMetaEventFn = createServerFn({ method: "POST" })
  .validator((input: MetaEventInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaContract, context.cookie).createEvent(data),
  );

export function useCreateMetaEvent() {
  return useMutationWithInvalidation({
    mutationFn: (vars: MetaEventInput) => createMetaEventFn({ data: vars }),
    invalidates: [adminKeys.meta.events, metaKeys.all],
  });
}

const updateMetaEventFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; slug: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminMetaContract, context.cookie).updateEvent(data);
  });

/** Only renames the slug; other event facts are corrected as overlays. */
export function useUpdateMetaEvent() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { id: string; slug: string }) => updateMetaEventFn({ data: vars }),
    invalidates: [adminKeys.meta.events, metaKeys.all],
  });
}

const deleteMetaEventFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminMetaContract, context.cookie).deleteEvent({ id: data.id });
  });

export function useDeleteMetaEvent() {
  return useMutationWithInvalidation({
    mutationFn: (id: string) => deleteMetaEventFn({ data: { id } }),
    invalidates: (id) => [adminKeys.meta.events, adminKeys.meta.eventPlayers(id), metaKeys.all],
  });
}

export function useAdminMetaEventPlayers(eventId: string) {
  return useSuspenseQuery(adminMetaEventPlayersQueryOptions(eventId));
}

/** `list` absent creates a standings-only row. */
export interface CreateMetaPlayerInput {
  eventId: string;
  playerName: string;
  rank: number;
  rankIsTier?: boolean;
  wins?: number | null;
  losses?: number | null;
  draws?: number | null;
  legendCardId?: string | null;
  championCardId?: string | null;
  list?: MetaPlayerListInput | null;
}

const createMetaPlayerFn = createServerFn({ method: "POST" })
  .validator((input: CreateMetaPlayerInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaContract, context.cookie).createPlayer(data),
  );

export function useCreateMetaPlayer() {
  return useMutationWithInvalidation({
    mutationFn: (vars: CreateMetaPlayerInput) => createMetaPlayerFn({ data: vars }),
    invalidates: (vars) => [
      adminKeys.meta.eventPlayers(vars.eventId),
      adminKeys.meta.events,
      metaKeys.all,
    ],
  });
}

const renamePlayerDeckFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; eventId: string; name: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminMetaContract, context.cookie).renamePlayerDeck({
      id: data.id,
      name: data.name,
    });
  });

/** Not an overlay: promotion preserves deck names, so this survives a re-promote. */
export function useRenamePlayerDeck() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { id: string; eventId: string; name: string }) =>
      renamePlayerDeckFn({ data: vars }),
    invalidates: (vars) => [
      adminKeys.meta.eventPlayers(vars.eventId),
      adminKeys.meta.events,
      metaKeys.all,
    ],
  });
}

const deleteMetaPlayerFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminMetaContract, context.cookie).deletePlayer({ id: data.id });
  });

export function useDeleteMetaPlayer() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { id: string; eventId: string }) =>
      deleteMetaPlayerFn({ data: { id: vars.id } }),
    invalidates: (vars) => [
      adminKeys.meta.eventPlayers(vars.eventId),
      adminKeys.meta.events,
      metaKeys.all,
    ],
  });
}

const fetchMetaEventSources = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ sources: AdminMetaEventSource[] }> =>
    apiOrpcClient(adminMetaContract, context.cookie).eventSources({ id: data.id }),
  );

function adminMetaEventSourcesQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: adminKeys.meta.eventSources(eventId),
    queryFn: () => fetchMetaEventSources({ data: { id: eventId } }),
    staleTime: 5 * 60 * 1000,
  });
}

/** Plain, not suspense: opens inside a dialog with no loader to warm it. */
export function useAdminMetaEventSources(eventId: string | null) {
  return useQuery({
    ...adminMetaEventSourcesQueryOptions(eventId ?? ""),
    enabled: eventId !== null,
  });
}

/** Provider citations are written by linking, never through this input. */
export type CreateMetaEventSourceInput = Omit<
  ContractInput<typeof adminMetaContract, "createEventSource">,
  "id"
> & {
  eventId: string;
};

const createMetaEventSourceFn = createServerFn({ method: "POST" })
  .validator((input: CreateMetaEventSourceInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<AdminMetaEventSource> =>
    apiOrpcClient(adminMetaContract, context.cookie).createEventSource({
      id: data.eventId,
      label: data.label,
      sourceUrl: data.sourceUrl ?? null,
    }),
  );

export function useCreateMetaEventSource() {
  return useMutationWithInvalidation<AdminMetaEventSource, CreateMetaEventSourceInput>({
    mutationFn: (vars) => createMetaEventSourceFn({ data: vars }),
    invalidates: (vars) => [adminKeys.meta.eventSources(vars.eventId), metaKeys.all],
  });
}

const deleteMetaEventSourceFn = createServerFn({ method: "POST" })
  .validator((input: { eventId: string; sourceId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminMetaContract, context.cookie).deleteEventSource({
      id: data.eventId,
      sourceId: data.sourceId,
    });
  });

/** The API refuses a provider row; unlinking its candidate removes it instead. */
export function useDeleteMetaEventSource() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { eventId: string; sourceId: string }) =>
      deleteMetaEventSourceFn({ data: vars }),
    invalidates: (vars) => [adminKeys.meta.eventSources(vars.eventId), metaKeys.all],
  });
}
