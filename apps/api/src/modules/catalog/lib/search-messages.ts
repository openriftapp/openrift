import { FOREIGN_KEY_HINTS } from "@openrift/shared/search-query/keys";
import type { SearchDiagnostic } from "@openrift/shared/search-query/parse";

export function describeSearchDiagnostic(diagnostic: SearchDiagnostic, q: string): string {
  const expression = q.slice(diagnostic.span.start, diagnostic.span.end);
  const ignored = `Invalid expression "${expression}" was ignored.`;
  switch (diagnostic.code) {
    case "unknownKey": {
      const key = (diagnostic.key ?? "").toLowerCase();
      const hint = FOREIGN_KEY_HINTS[key];
      return `${ignored} Unknown keyword "${key}".${hint ? ` Use "${hint}" instead.` : ""}`;
    }
    case "unknownValue": {
      return `${ignored} Unknown value "${diagnostic.value}" for "${diagnostic.key}".`;
    }
    case "ambiguousValue": {
      return `${ignored} "${diagnostic.value}" matches more than one value for "${diagnostic.key}".`;
    }
    case "emptyValue": {
      return `${ignored} "${diagnostic.key}" needs a value.`;
    }
    case "emptyGroup": {
      return "Empty parentheses were ignored.";
    }
    case "danglingOr": {
      return `"or" with nothing after it was ignored.`;
    }
    case "badValue": {
      return `"${expression}" has a value "${diagnostic.key}" cannot take.`;
    }
    case "badOperator": {
      return `"${diagnostic.key}" does not take the comparison in "${expression}".`;
    }
    case "unbalancedParen": {
      return "Your search contains unbalanced parentheses.";
    }
    case "unsupportedKey": {
      return `"${diagnostic.key}" depends on the signed-in viewer and is not available in the API.`;
    }
  }
}
