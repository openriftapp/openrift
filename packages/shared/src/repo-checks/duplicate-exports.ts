import ts from "typescript";

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((mod) => mod.kind === kind)
  );
}

function bindingNames(name: ts.BindingName, into: Set<string>): void {
  if (ts.isIdentifier(name)) {
    into.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) {
      bindingNames(element.name, into);
    }
  }
}

export function collectExportNames(fileName: string, source: string): Set<string> {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (
        !statement.moduleSpecifier &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const element of statement.exportClause.elements) {
          if (element.name.text !== "default") {
            names.add(element.name.text);
          }
        }
      }
      continue;
    }
    if (
      !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        bindingNames(declaration.name, names);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)) &&
      statement.name &&
      ts.isIdentifier(statement.name)
    ) {
      names.add(statement.name.text);
    }
  }
  return names;
}

export function findDuplicateNames(
  exportsByFile: ReadonlyMap<string, Iterable<string>>,
): Map<string, string[]> {
  const filesByName = new Map<string, string[]>();
  for (const [file, names] of exportsByFile) {
    for (const name of names) {
      filesByName.set(name, [...(filesByName.get(name) ?? []), file]);
    }
  }
  const duplicates = new Map<string, string[]>();
  for (const name of [...filesByName.keys()].toSorted()) {
    const files = filesByName.get(name) ?? [];
    if (files.length > 1) {
      duplicates.set(name, files.toSorted());
    }
  }
  return duplicates;
}

type FileCounts = ReadonlyMap<string, number>;

export function parseBaseline(text: string): Map<string, number> {
  const baseline = new Map<string, number>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    const match = /^(?<name>\S+) (?<count>\d+)$/u.exec(trimmed);
    if (!match?.groups) {
      throw new Error(`Baseline line must be "<name> <file count>", got "${trimmed}".`);
    }
    baseline.set(match.groups.name ?? "", Number(match.groups.count));
  }
  return baseline;
}

export function formatBaseline(baseline: FileCounts): string {
  return [...baseline.keys()]
    .toSorted()
    .map((name) => `${name} ${baseline.get(name)}\n`)
    .join("");
}

export function diffBaseline(
  current: FileCounts,
  baseline: FileCounts,
): { grown: string[]; shrunk: string[] } {
  return {
    grown: [...current.keys()]
      .filter((name) => (current.get(name) ?? 0) > (baseline.get(name) ?? 0))
      .toSorted(),
    shrunk: [...baseline.keys()]
      .filter((name) => (current.get(name) ?? 0) < (baseline.get(name) ?? 0))
      .toSorted(),
  };
}

export function nextBaseline(
  current: FileCounts,
  baseline: FileCounts,
  allowGrowth: boolean,
): Map<string, number> {
  if (allowGrowth) {
    return new Map(current);
  }
  const next = new Map<string, number>();
  for (const [name, recorded] of baseline) {
    const count = current.get(name);
    if (count !== undefined) {
      next.set(name, Math.min(count, recorded));
    }
  }
  return next;
}
