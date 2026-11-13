import type { Element } from "../modules/system/services/share-image-core.js";

export function textsOf(node: unknown): string[] {
  if (typeof node === "string") {
    return [node];
  }
  if (Array.isArray(node)) {
    return node.flatMap((child) => textsOf(child));
  }
  if (node !== null && typeof node === "object" && "props" in node) {
    return textsOf((node as Element).props.children);
  }
  return [];
}
