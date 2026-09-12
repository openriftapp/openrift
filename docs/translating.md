# Translating OpenRift

OpenRift's interface is translated on [Hosted Weblate](https://hosted.weblate.org/projects/openrift/). You do not need a GitHub account or any development setup: create a Weblate account, pick a language, and start suggesting. Everything you write is reviewed before it goes live.

## What is in scope

Weblate holds the interface strings only: buttons, labels, headings, help text, emails. They live in `apps/web/messages/{locale}.json` and are compiled into the app at build time, so an approved translation appears on the site with the next deploy.

Card data is not here. Card names, rules text, and keyword labels come from the catalogue database and follow the printed cards. Corrections to those go through [/contribute](https://openrift.app/contribute) instead.

English is the source language. If an English string is wrong or unclear, do not fix it in your translation: open an issue or say so in a Weblate comment, and it gets fixed at the source for every language at once.

## License

Translations are contributed under the [AGPL-3.0](../LICENSE), the same license as the rest of OpenRift. By submitting a translation you agree it can be published under those terms.

## Voice

OpenRift talks to one person who is organising their own cards. Sentences are short, plain, and say what happens. No marketing language, no exclamation marks, no jokes that only work in English.

German uses informal address throughout: `du`, `dein`, lowercase mid-sentence. French uses formal address: `vous`, `votre`. Both conventions are already established across the existing strings, so follow the one for your language.

Keep the register of the source. An error message stays factual and never blames the reader. A short label stays short: interface space is fixed, and a label three times longer than the English wraps or truncates. If your language genuinely cannot be that terse, leave a comment so the layout can be adjusted.

Capitalisation follows your language, not the source. Where English capitalises a product noun (Wishlist, Tradelist), German capitalises nouns as German does, and French does not.

## Placeholders

Strings contain placeholders in curly braces: `{count}`, `{name}`, `{deck}`. Every placeholder in the source must appear in your translation, spelled exactly the same. Do not translate the name inside the braces, do not add spaces inside them, and do not invent new ones. Reordering them within the sentence is fine and often necessary.

There are no plural forms in the message files. Where a count needs different wording, the interface uses separate strings. If a source string cannot be translated correctly without a plural rule your language requires, leave a comment instead of forcing it.

## Terminology

These are the product's own words. Use the table, not a synonym, and use the same word every time.

| English          | German      | French            |
| ---------------- | ----------- | ----------------- |
| Card             | Karte       | Carte             |
| Printing         | Druck       | Impression        |
| Set              | Set         | Set               |
| Variant          | Variante    | Variante          |
| Finish           | Veredelung  | Finition          |
| Condition        | Zustand     | État              |
| Grade            | Note        | Note              |
| Rarity           | Seltenheit  | Rareté            |
| Domain           | Domäne      | Domaine           |
| Copy (of a card) | Exemplar    | Exemplaire        |
| Collection       | Sammlung    | Collection        |
| Deck             | Deck        | Deck              |
| List             | Liste       | Liste             |
| Wishlist         | Wunschliste | Liste de souhaits |
| Tradelist        | Tauschliste | Liste d'échange   |
| Trade            | Tausch      | Échange           |
| Group            | Gruppe      | Groupe            |
| Tournament       | Turnier     | Tournoi           |
| Owned            | Im Besitz   | Possédées         |
| Wanted           | Gesucht     | Recherchées       |
| Missing          | Fehlend     | Manquantes        |

Riftbound's own game vocabulary stays in English in every language, because that is how players say it at the table and how the cards read: Legend, Battlefield, Rune, Unit, Spell, Gear, playset, deck check, pod, judge. Brand and product names are never translated: OpenRift, Riftbound, Riot Games, TCGplayer, CardTrader, Cardmarket, Discord.

Never borrow Magic: The Gathering vocabulary. No mana, no tapping, no Commander, no Planeswalker, in any language. If you need a flavourful example or placeholder, take it from League of Legends and Riftbound.

Internal names do not belong in translated text. If an English string contains a schema word (kind, slug, intent, entity), translate the meaning a player would understand and leave a comment so the English gets fixed.

## The catalogue is one person's work

The card data is maintained by a single person with help from contributors. Where a string talks about gaps in the data, keep that framing: honest about what is missing, inviting about filling it in. Do not turn it into a claim that the catalogue is community-built or complete.

## Review

New contributors translate in suggestion mode: your work is queued, not published. A reviewer for your language approves it, and the string ships with the next deploy. If you want to review for a language you speak natively, ask in a Weblate comment or on [Discord](https://discord.gg/Qb6RcjXq6z).

Machine translation is available in the editor as a starting point. It is a starting point. A suggestion that is visibly untouched machine output gets rejected, because the whole reason for a human translator is the part the machine gets wrong.
