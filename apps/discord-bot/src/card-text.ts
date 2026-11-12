/**
 * Card text markup to Discord markdown. Tokenizing is `tokenizeCardText`
 * from `@openrift/shared`, the same one the site renders from; this covers
 * only the Discord side: custom emojis for glyphs, inline code for keywords.
 */

import type { CardTextToken } from "@openrift/shared/card-text";
import { glyphWord, tokenizeCardText } from "@openrift/shared/card-text";

import type { GlyphEmojis } from "./glyph-emoji.js";

/** Discord prints code-span contents literally; keep the glyph outside the code span. */
function keywordChip(children: CardTextToken[], emojis: GlyphEmojis): string {
  const parts: string[] = [];
  let run = "";

  function flushRun(): void {
    const text = run.trim();
    if (text.length > 0) {
      parts.push(`\`${text}\``);
    }
    run = "";
  }

  function walk(tokens: CardTextToken[]): void {
    for (const token of tokens) {
      switch (token.type) {
        case "glyph": {
          flushRun();
          parts.push(emojis.get(token.name) ?? glyphWord(token.name));
          break;
        }
        case "text": {
          run += token.value;
          break;
        }
        case "newline": {
          run += "\n";
          break;
        }
        case "keyword": {
          run += "[";
          walk(token.children);
          run += "]";
          break;
        }
        case "paren": {
          run += "(";
          walk(token.children);
          run += ")";
          break;
        }
        case "italic": {
          run += "_";
          walk(token.children);
          run += "_";
          break;
        }
      }
    }
  }

  walk(children);
  flushRun();
  return parts.filter((part) => part.length > 0).join(" ");
}

function renderToken(token: CardTextToken, emojis: GlyphEmojis): string {
  switch (token.type) {
    case "text": {
      return token.value;
    }
    case "newline": {
      return "\n";
    }
    case "glyph": {
      return emojis.get(token.name) ?? glyphWord(token.name);
    }
    case "keyword": {
      // The site angles the neighbouring chip's edge for these markers;
      // Discord has no chip shapes, so a stray one is dropped here.
      return token.name === ">" || token.name === ">>" ? "" : keywordChip(token.children, emojis);
    }
    case "paren": {
      return `(${renderTokens(token.children, emojis)})`;
    }
    case "italic": {
      // Rewritten to `*...*`: Discord's `_..._` italics need a word boundary
      // at the closing underscore, which an emoji mention right before it doesn't give.
      return `*${renderTokens(token.children, emojis)}*`;
    }
  }
}

function renderTokens(tokens: CardTextToken[], emojis: GlyphEmojis): string {
  return tokens.map((token) => renderToken(token, emojis)).join("");
}

export function formatCardText(text: string, emojis: GlyphEmojis): string {
  return renderTokens(tokenizeCardText(text), emojis).trim();
}
