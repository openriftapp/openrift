import type { SortDirection, SortOption } from "../types/search.js";
import type { PreferValue, SearchKeyDefinition, SearchKeyId, SearchOperator } from "./keys.js";
import {
  DIRECTION_VALUES,
  HAS_VALUES,
  IS_VALUES,
  operatorsFor,
  ORDER_VALUES,
  PREFER_VALUES,
  searchKeyByAlias,
  UNIQUE_VALUES,
} from "./keys.js";

/** Character offsets into the raw query, end exclusive. */
interface SearchSpan {
  start: number;
  end: number;
}

export type QueryNode =
  | { kind: "and"; children: QueryNode[] }
  | { kind: "or"; children: QueryNode[] }
  | { kind: "not"; child: QueryNode }
  | { kind: "text"; value: string; span: SearchSpan }
  | { kind: "exact"; value: string; span: SearchSpan }
  | {
      kind: "clause";
      key: SearchKeyId;
      operator: SearchOperator;
      value: string;
      span: SearchSpan;
    }
  | { kind: "invalid"; span: SearchSpan };

type SearchDiagnosticCode =
  | "unknownKey"
  | "badOperator"
  | "badValue"
  | "emptyValue"
  | "unknownValue"
  | "unbalancedParen"
  | "emptyGroup"
  | "danglingOr"
  | "unsupportedKey";

export interface SearchDiagnostic {
  code: SearchDiagnosticCode;
  severity: "warning" | "error";
  span: SearchSpan;
  key?: string;
  value?: string;
}

export interface SearchClause {
  key: SearchKeyId;
  operator: SearchOperator;
  value: string;
  negated: boolean;
  span: SearchSpan;
}

interface SearchDirectives {
  order?: SortOption;
  direction?: SortDirection;
  unique?: (typeof UNIQUE_VALUES)[number];
  prefer?: PreferValue;
}

export interface ParsedSearchQuery {
  root: QueryNode | null;
  clauses: SearchClause[];
  directives: SearchDirectives;
  diagnostics: SearchDiagnostic[];
}

const CLAUSE_HEAD = /(?<alias>[a-z]+)(?<operator>!=|<=|>=|:|=|<|>)/iuy;
const DATE_VALUE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u;
const NUMBER_VALUE = /^-?\d+(?:\.\d+)?$/u;

class Parser {
  private pos = 0;
  private depth = 0;
  readonly clauses: SearchClause[] = [];
  readonly directives: SearchDirectives = {};
  readonly diagnostics: SearchDiagnostic[] = [];

  private readonly raw: string;

  constructor(raw: string) {
    this.raw = raw;
  }

  parse(): QueryNode | null {
    const nodes: QueryNode[] = [];
    while (this.skipWhitespace()) {
      if (this.raw[this.pos] === ")") {
        this.diagnostics.push({
          code: "unbalancedParen",
          severity: "error",
          span: { start: this.pos, end: this.pos + 1 },
        });
        this.pos += 1;
        continue;
      }
      const node = this.parseOr(false);
      if (node) {
        nodes.push(node);
      }
    }
    return combine("and", nodes);
  }

  private skipWhitespace(): boolean {
    while (this.pos < this.raw.length && /\s/u.test(this.raw[this.pos] as string)) {
      this.pos += 1;
    }
    return this.pos < this.raw.length;
  }

  private atClose(): boolean {
    return this.depth > 0 && this.raw[this.pos] === ")";
  }

  private atOr(): boolean {
    if (this.raw.slice(this.pos, this.pos + 2).toLowerCase() !== "or") {
      return false;
    }
    const next = this.raw[this.pos + 2];
    return next === undefined || /\s/u.test(next) || next === "(" || next === ")";
  }

  private parseOr(negated: boolean): QueryNode | null {
    const branches: QueryNode[] = [];
    const first = this.parseAnd(negated);
    if (first) {
      branches.push(first);
    }
    while (this.skipWhitespace() && this.atOr()) {
      const start = this.pos;
      this.pos += 2;
      const next = this.parseAnd(negated);
      if (next) {
        branches.push(next);
      } else {
        this.diagnostics.push({
          code: "danglingOr",
          severity: "warning",
          span: { start, end: start + 2 },
        });
      }
    }
    return combine("or", branches);
  }

  private parseAnd(negated: boolean): QueryNode | null {
    const items: QueryNode[] = [];
    while (this.skipWhitespace() && !this.atClose()) {
      // A leading "or" has nothing to join, so it falls through as a word.
      if (this.atOr() && items.length > 0) {
        break;
      }
      if (this.depth === 0 && this.raw[this.pos] === ")") {
        break;
      }
      const node = this.parseUnary(negated);
      if (node) {
        items.push(node);
      }
    }
    return combine("and", items);
  }

  private parseUnary(negated: boolean): QueryNode | null {
    const char = this.raw[this.pos];
    const next = this.raw[this.pos + 1];
    if (char === "-" && next !== undefined && !/\s/u.test(next)) {
      this.pos += 1;
      const child = this.parseUnary(!negated);
      return child ? { kind: "not", child } : null;
    }
    return this.parsePrimary(negated);
  }

  private parsePrimary(negated: boolean): QueryNode | null {
    const start = this.pos;
    const char = this.raw[this.pos];
    if (char === "(") {
      this.pos += 1;
      this.depth += 1;
      const inner = this.parseOr(negated);
      this.skipWhitespace();
      if (this.raw[this.pos] === ")") {
        this.pos += 1;
      } else {
        this.diagnostics.push({
          code: "unbalancedParen",
          severity: "error",
          span: { start, end: start + 1 },
        });
      }
      this.depth -= 1;
      if (!inner) {
        this.diagnostics.push({
          code: "emptyGroup",
          severity: "warning",
          span: { start, end: this.pos },
        });
      }
      return inner;
    }
    if (char === "!") {
      this.pos += 1;
      const value = this.readValue();
      const span = { start, end: this.pos };
      if (value === "") {
        return null;
      }
      return { kind: "exact", value, span };
    }
    if (char === '"') {
      const value = this.readValue();
      return value.trim() === "" ? null : { kind: "text", value, span: { start, end: this.pos } };
    }

    CLAUSE_HEAD.lastIndex = this.pos;
    const head = CLAUSE_HEAD.exec(this.raw);
    if (head) {
      const [whole] = head;
      const { alias = "", operator = "" } = head.groups ?? {};
      const definition = searchKeyByAlias(alias);
      if (definition) {
        this.pos += whole.length;
        const quoted = this.raw[this.pos] === '"';
        const read = this.readValue();
        // "t:spell, t:unit" reads naturally as a list; no unquoted value ends in a comma.
        const value = quoted ? read : read.replace(/,+$/u, "");
        return this.buildClause(
          definition,
          alias,
          operator as SearchOperator,
          value,
          { start, end: this.pos },
          negated,
        );
      }
      const word = this.readValue();
      const span = { start, end: this.pos };
      this.diagnostics.push({ code: "unknownKey", severity: "warning", span, key: alias });
      return { kind: "text", value: word, span };
    }

    const word = this.readValue();
    return word === "" ? null : { kind: "text", value: word, span: { start, end: this.pos } };
  }

  private readValue(): string {
    if (this.raw[this.pos] === '"') {
      const close = this.raw.indexOf('"', this.pos + 1);
      const end = close === -1 ? this.raw.length : close;
      const value = this.raw.slice(this.pos + 1, end);
      this.pos = close === -1 ? end : end + 1;
      return value;
    }
    const start = this.pos;
    while (this.pos < this.raw.length) {
      const char = this.raw[this.pos] as string;
      if (/\s/u.test(char) || (char === ")" && this.depth > 0)) {
        break;
      }
      this.pos += 1;
    }
    return this.raw.slice(start, this.pos);
  }

  private buildClause(
    definition: SearchKeyDefinition,
    alias: string,
    operator: SearchOperator,
    rawValue: string,
    span: SearchSpan,
    negated: boolean,
  ): QueryNode | null {
    const value =
      definition.kind === "text" || definition.kind === "code" ? rawValue : rawValue.toLowerCase();
    if (value.trim() === "") {
      this.diagnostics.push({ code: "emptyValue", severity: "warning", span, key: alias });
      return null;
    }
    if (!operatorsFor(definition.kind).includes(operator)) {
      this.diagnostics.push({ code: "badOperator", severity: "error", span, key: alias, value });
      return { kind: "invalid", span };
    }
    const comparison = operator !== ":" && operator !== "=" && operator !== "!=";
    const normalized =
      definition.kind === "code" && comparison
        ? NUMBER_VALUE.test(value)
          ? value
          : null
        : normalizeValue(definition, value);
    if (normalized === null) {
      this.diagnostics.push({ code: "badValue", severity: "error", span, key: alias, value });
      return { kind: "invalid", span };
    }
    if (definition.kind === "directive") {
      if (definition.id === "order") {
        this.directives.order = normalized as SortOption;
      } else if (definition.id === "direction") {
        this.directives.direction = normalized as SortDirection;
      } else if (definition.id === "prefer") {
        this.directives.prefer = normalized as PreferValue;
      } else {
        this.directives.unique = normalized as SearchDirectives["unique"];
      }
      this.clauses.push({ key: definition.id, operator, value: normalized, negated, span });
      return null;
    }
    this.clauses.push({ key: definition.id, operator, value: normalized, negated, span });
    return { kind: "clause", key: definition.id, operator, value: normalized, span };
  }
}

function normalizeValue(definition: SearchKeyDefinition, value: string): string | null {
  switch (definition.kind) {
    case "number": {
      return NUMBER_VALUE.test(value) ? value : null;
    }
    case "date": {
      return DATE_VALUE.test(value) ? value : null;
    }
    case "set": {
      const parts = value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part !== "");
      return parts.length > 0 ? parts.join(",") : null;
    }
    case "flag": {
      if (definition.id === "is" || definition.id === "not") {
        const folded = value.replaceAll("-", "");
        return (IS_VALUES as readonly string[]).includes(folded) ? folded : null;
      }
      if (definition.id === "has") {
        return (HAS_VALUES as readonly string[]).includes(value) ? value : null;
      }
      return value;
    }
    case "directive": {
      const allowed: readonly string[] =
        definition.id === "order"
          ? ORDER_VALUES
          : definition.id === "direction"
            ? DIRECTION_VALUES
            : definition.id === "prefer"
              ? PREFER_VALUES
              : UNIQUE_VALUES;
      return allowed.includes(value) ? value : null;
    }
    default: {
      return value;
    }
  }
}

function combine(kind: "and" | "or", nodes: QueryNode[]): QueryNode | null {
  if (nodes.length === 0) {
    return null;
  }
  if (nodes.length === 1) {
    return nodes[0] as QueryNode;
  }
  return { kind, children: nodes };
}

const PARSE_CACHE = new Map<string, ParsedSearchQuery>();
const PARSE_CACHE_LIMIT = 200;

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const cached = PARSE_CACHE.get(raw);
  if (cached) {
    return cached;
  }
  const parser = new Parser(raw);
  const root = parser.parse();
  const parsed: ParsedSearchQuery = {
    root,
    clauses: parser.clauses,
    directives: parser.directives,
    diagnostics: parser.diagnostics,
  };
  if (PARSE_CACHE.size >= PARSE_CACHE_LIMIT) {
    PARSE_CACHE.clear();
  }
  PARSE_CACHE.set(raw, parsed);
  return parsed;
}

export function countQueryNodes(node: QueryNode | null): number {
  if (!node) {
    return 0;
  }
  if (node.kind === "and" || node.kind === "or") {
    return 1 + node.children.reduce((sum, child) => sum + countQueryNodes(child), 0);
  }
  if (node.kind === "not") {
    return 1 + countQueryNodes(node.child);
  }
  return 1;
}
