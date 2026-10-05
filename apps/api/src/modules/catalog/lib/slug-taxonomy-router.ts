import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import { AppError } from "../../../errors.js";
import { assertFound, assertSlugAvailable, assertValidReorder } from "../../../lib/assertions.js";
import type { ApiContext } from "../../../orpc/context.js";
import type { SlugTaxonomyRepo, SlugTaxonomyTable } from "../repositories/slug-taxonomy.js";

/** Per-router config for the seven slug-keyed admin taxonomy routers; shared behavior lives in {@link createSlugTaxonomyHandlers}. */
export interface SlugTaxonomyRouterConfig<T extends SlugTaxonomyTable, CreateKey extends string> {
  repoKey: T;
  entityName: string;
  createKey: CreateKey;
  inUseBy: string;
  hasColor?: boolean;
  afterReorder?: (context: ApiContext) => Promise<void>;
}

interface CreateInput {
  slug: string;
  label: string;
  color?: string | null;
}

interface UpdateInput {
  slug: string;
  label?: string;
  color?: string | null;
}

/** Typed as a proper mapped type; a plain computed-property literal would widen to `{ [x: string]: V }`. */
function keyed<K extends string, V>(key: K, value: V): Record<K, V> {
  return { [key]: value } as Record<K, V>;
}

type TaxonomyKeyColumn = "id" | "code" | "slug";

interface KeyedTaxonomyRepo<Row> {
  listAll: () => Promise<Row[]>;
  reorder: (keys: readonly string[]) => Promise<void>;
  isInUse: (key: string) => Promise<unknown>;
}

/** Reorder and remove for any taxonomy keyed by `keyColumn`; the reorder input field is its plural (`ids`, `codes`, `slugs`). */
export interface KeyedTaxonomyConfig<Row, Key extends TaxonomyKeyColumn> {
  keyColumn: Key;
  entityName: string;
  inUseBy: string;
  repo: (context: ApiContext) => KeyedTaxonomyRepo<Row>;
  getByKey: (context: ApiContext, key: string) => Promise<Row | undefined>;
  deleteByKey: (context: ApiContext, key: string) => Promise<unknown>;
  notFoundMessage?: (key: string) => string;
  keyNoun?: string;
  guardWellKnown?: boolean;
  afterReorder?: (context: ApiContext) => Promise<void>;
}

export interface KeyedTaxonomyHandlers<Key extends TaxonomyKeyColumn> {
  reorder: (args: { input: Record<`${Key}s`, string[]>; context: ApiContext }) => Promise<void>;
  remove: (args: { input: Record<Key, string>; context: ApiContext }) => Promise<void>;
}

export function createKeyedTaxonomyHandlers<Row, Key extends TaxonomyKeyColumn>(
  config: KeyedTaxonomyConfig<Row, Key>,
): KeyedTaxonomyHandlers<Key> {
  const { keyColumn, entityName, inUseBy, repo: repoOf, getByKey, deleteByKey } = config;
  const { guardWellKnown, afterReorder } = config;
  const entityLower = entityName.toLowerCase();
  const keyNoun = config.keyNoun ?? `${keyColumn}s`;
  const notFoundMessage =
    config.notFoundMessage ?? ((key: string) => `${entityName} "${key}" not found`);

  function keyOf(row: Row): string {
    return (row as Record<Key, string>)[keyColumn];
  }

  return {
    async reorder({ input, context }) {
      const repo = repoOf(context);
      const keys = (input as Record<string, string[]>)[`${keyColumn}s`] ?? [];
      const all = await repo.listAll();
      assertValidReorder(keys, all, {
        keyOf,
        keyNoun,
        unknownLabel: `${entityLower} ${keyColumn}s`,
      });
      await repo.reorder(keys);
      if (afterReorder) {
        await afterReorder(context);
      }
    },

    async remove({ input, context }) {
      const key = (input as Record<Key, string>)[keyColumn];
      const existing = await getByKey(context, key);
      assertFound(existing, notFoundMessage(key));

      if (guardWellKnown && (existing as { isWellKnown: boolean }).isWellKnown) {
        throw new AppError(409, ERROR_CODES.CONFLICT, `Cannot delete a well-known ${entityLower}`);
      }

      if (await repoOf(context).isInUse(key)) {
        throw new AppError(
          409,
          ERROR_CODES.CONFLICT,
          `Cannot delete: ${entityLower} is in use by ${inUseBy}`,
        );
      }

      await deleteByKey(context, key);
    },
  };
}

/** Spelled out explicitly: Kysely's `Selectable<Database[T]>` pulls in an internal type TS can't print from an inferred return position. */
export interface SlugTaxonomyHandlers<T extends SlugTaxonomyTable, CreateKey extends string> {
  list: (args: { context: ApiContext }) => Promise<Record<T, Selectable<Database[T]>[]>>;
  reorder: (args: { input: { slugs: string[] }; context: ApiContext }) => Promise<void>;
  create: (args: {
    input: CreateInput;
    context: ApiContext;
  }) => Promise<Record<CreateKey, Selectable<Database[T]>>>;
  update: (args: { input: UpdateInput; context: ApiContext }) => Promise<void>;
  remove: (args: { input: { slug: string }; context: ApiContext }) => Promise<void>;
}

/** Each router wires these into its own contract-bound `os.*` procedures; route, method, status and error code still come from that contract. */
export function createSlugTaxonomyHandlers<T extends SlugTaxonomyTable, CreateKey extends string>(
  config: SlugTaxonomyRouterConfig<T, CreateKey>,
): SlugTaxonomyHandlers<T, CreateKey> {
  const { repoKey, entityName, createKey, inUseBy, hasColor, afterReorder } = config;
  function repoOf(context: ApiContext): SlugTaxonomyRepo<T> {
    const repos = context.repos as unknown as Record<T, SlugTaxonomyRepo<T>>;
    return repos[repoKey];
  }

  const keyedHandlers = createKeyedTaxonomyHandlers({
    keyColumn: "slug",
    entityName,
    inUseBy,
    repo: repoOf,
    getByKey: (context, slug) => repoOf(context).getBySlug(slug),
    deleteByKey: (context, slug) => repoOf(context).deleteBySlug(slug),
    guardWellKnown: true,
    afterReorder,
  });

  return {
    async list({ context }: { context: ApiContext }) {
      const rows = await repoOf(context).listAll();
      return keyed(repoKey, rows);
    },

    reorder: keyedHandlers.reorder,

    async create({ input, context }: { input: CreateInput; context: ApiContext }) {
      const repo = repoOf(context);
      const { slug, label, color } = input;

      const existing = await repo.getBySlug(slug);
      assertSlugAvailable(existing, slug, entityName);

      const created = await repo.create(
        (hasColor ? { slug, label, color } : { slug, label }) as never,
      );
      return keyed(createKey, created);
    },

    async update({ input, context }: { input: UpdateInput; context: ApiContext }): Promise<void> {
      const repo = repoOf(context);

      const existing = await repo.getBySlug(input.slug);
      assertFound(existing, `${entityName} "${input.slug}" not found`);

      if (hasColor) {
        const updates: { label?: string; color?: string | null } = {};
        if (input.label !== undefined) {
          updates.label = input.label;
        }
        if (input.color !== undefined) {
          updates.color = input.color;
        }
        if (Object.keys(updates).length > 0) {
          await repo.update(input.slug, updates as never);
        }
      } else if (input.label) {
        await repo.update(input.slug, { label: input.label } as never);
      }
    },

    remove: keyedHandlers.remove,
  };
}
