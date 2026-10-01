const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Text of HTML from @openrift/shared/rules-html, which only escapes these five entities. */
export function ruleHtmlToText(html: string): string {
  return html
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/&(?:amp|lt|gt|quot|#39);/gu, (entity) => ENTITIES[entity] ?? entity);
}

const searchTextByRule = new WeakMap<object, string>();

export function ruleSearchText(rule: { contentHtml: string }): string {
  let text = searchTextByRule.get(rule);
  if (text === undefined) {
    text = ruleHtmlToText(rule.contentHtml).toLowerCase();
    searchTextByRule.set(rule, text);
  }
  return text;
}
