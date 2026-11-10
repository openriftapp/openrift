import type { Plugin } from "vite";

interface ChunkNode {
  name: string;
  imports: readonly string[];
  modules?: Readonly<Record<string, { renderedLength: number }>>;
}

const FORBIDDEN_BOOT_CHUNKS = ["base-ui"];

const CLASSIC_ZOD_MODULE = /[/\\]node_modules[/\\]zod[/\\](?:v3|v4[/\\](?:classic|locales))[/\\]/u;

const ADMIN_MODULE = /[/\\]src[/\\](?<path>features[/\\](?:admin|catalog-workspace)[/\\][^?]+)/u;

const ALLOWED_BOOT_ADMIN_MODULES: Readonly<Record<string, string>> = {
  "features/admin/lib/admin-query-keys.ts":
    "query keys shared with public catalog hooks (sets, card types, rules, site settings)",
  "features/admin/hooks/use-admin.ts": "the header and card pages decide whether to link to /admin",
  "features/admin/lib/admin-queries.ts": "the access query behind use-admin and the /admin guard",
  "features/admin/lib/admin-sections.ts":
    "the /admin beforeLoad guard maps a path to a grant holder's section",
  "features/admin/lib/admin-search-values.ts": "value lists read by admin validateSearch",
  "features/admin/lib/admin-job-runs-search.ts": "validateSearch schema",
  "features/admin/lib/admin-meta-search.ts": "validateSearch schema",
  "features/catalog-workspace/lib/workspace-search.ts": "validateSearch schema",
  "features/admin/components/admin-route-components.tsx":
    "the pending skeleton renders before the route's chunks load",
};

export function bootAdminModules(
  chunk: ChunkNode,
  allowed: Readonly<Record<string, string>> = ALLOWED_BOOT_ADMIN_MODULES,
): string[] {
  return Object.entries(chunk.modules ?? {}).flatMap(([id, module]) => {
    const relative = ADMIN_MODULE.exec(id)?.groups?.path?.replaceAll("\\", "/");
    return module.renderedLength > 0 && relative !== undefined && !(relative in allowed)
      ? [relative]
      : [];
  });
}

export function findBootChunks(
  entry: string,
  chunks: ReadonlyMap<string, ChunkNode>,
  matches: (chunk: ChunkNode) => boolean,
): Map<string, string[]> {
  const parents = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  const found = new Map<string, string[]>();
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    const chunk = chunks.get(file);
    if (!chunk) {
      continue;
    }
    if (matches(chunk)) {
      const path: string[] = [];
      for (let at: string | null | undefined = file; at; at = parents.get(at)) {
        path.unshift(at);
      }
      found.set(file, path);
    }
    for (const next of chunk.imports) {
      if (!parents.has(next)) {
        parents.set(next, file);
        queue.push(next);
      }
    }
  }
  return found;
}

export function findForbiddenBootChunks(
  entry: string,
  chunks: ReadonlyMap<string, ChunkNode>,
  forbidden: readonly string[],
): Map<string, string[]> {
  return findBootChunks(entry, chunks, (chunk) => forbidden.includes(chunk.name));
}

export function classicZodModules(chunk: ChunkNode): string[] {
  return Object.entries(chunk.modules ?? {})
    .filter(([id, module]) => module.renderedLength > 0 && CLASSIC_ZOD_MODULE.test(id))
    .map(([id]) => id);
}

export function bootChunkGuardPlugin(): Plugin {
  return {
    name: "boot-chunk-guard",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle(_options, bundle) {
      const chunks = new Map<string, ChunkNode>();
      const entries: string[] = [];
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") {
          continue;
        }
        chunks.set(output.fileName, output);
        if (output.isEntry) {
          entries.push(output.fileName);
        }
      }
      const describe = (path: string[]) => `  ${path.join(" -> ")}`;
      const lazyProblems = entries.flatMap((entry) =>
        [...findForbiddenBootChunks(entry, chunks, FORBIDDEN_BOOT_CHUNKS).values()].map((path) =>
          describe(path),
        ),
      );
      if (lazyProblems.length > 0) {
        throw new Error(
          `A chunk that must load lazily is statically imported from the client entry:\n` +
            `${lazyProblems.join("\n")}\n\n` +
            "Every first page view downloads it. Add the module that pulls it in to the " +
            "`base-ui-shell` group in apps/web/vite.config.ts, or import it lazily.",
        );
      }
      const zodProblems = entries.flatMap((entry) =>
        [...findBootChunks(entry, chunks, (chunk) => classicZodModules(chunk).length > 0)].map(
          ([file, path]) => {
            const chunk = chunks.get(file);
            const modules = chunk ? classicZodModules(chunk) : [];
            return `${describe(path)}\n    ${modules.join("\n    ")}`;
          },
        ),
      );
      if (zodProblems.length > 0) {
        throw new Error(
          `Classic zod is statically reachable from the client entry (ADR-043):\n` +
            `${zodProblems.join("\n")}\n\n` +
            'Schemas built on the boot path import from "zod/mini". Find the boot module that ' +
            "imports classic zod, or a shared module that does, with `bun run analyze`.",
        );
      }
      const adminProblems = entries.flatMap((entry) =>
        [...findBootChunks(entry, chunks, (chunk) => bootAdminModules(chunk).length > 0)].map(
          ([file, path]) => {
            const chunk = chunks.get(file);
            const modules = chunk ? bootAdminModules(chunk) : [];
            return `${describe(path)}\n    ${modules.join("\n    ")}`;
          },
        ),
      );
      if (adminProblems.length > 0) {
        throw new Error(
          `Admin code is statically reachable from the client entry:\n` +
            `${adminProblems.join("\n")}\n\n` +
            "Admin route files import only what validateSearch and beforeLoad need; loaders " +
            "split off automatically (docs/contributing.md, routes). Move the import into the " +
            "loader or the .lazy.tsx file, or add the module to ALLOWED_BOOT_ADMIN_MODULES in " +
            "apps/web/vite-plugins/boot-chunk-guard.ts with a reason.",
        );
      }
    },
  };
}
