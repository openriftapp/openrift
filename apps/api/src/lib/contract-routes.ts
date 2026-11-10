import * as contracts from "@openrift/shared/contracts";

interface ContractRoute {
  method: string;
  path: string;
  meta: Record<string, unknown>;
}

interface ContractDef {
  route?: { method?: string; path?: string };
  meta?: Record<string, unknown>;
}

export function collectContractRoutes(): ContractRoute[] {
  const routes: ContractRoute[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    const def = (node as { "~orpc"?: ContractDef })["~orpc"];
    if (def?.route?.method && def.route.path) {
      routes.push({ method: def.route.method, path: def.route.path, meta: def.meta ?? {} });
      return;
    }
    for (const value of Object.values(node)) {
      visit(value);
    }
  };
  for (const [key, value] of Object.entries(contracts)) {
    if (key.endsWith("Contract")) {
      visit(value);
    }
  }
  return routes;
}
