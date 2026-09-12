# Design language

The visual identity beyond the type scale (see `typography.md` for fonts and sizes). These are the rules that keep the app from drifting back to stock-shadcn looks. When adding UI, follow them; when deliberately breaking one, update this file in the same change.

## The corner cut

A 45° cut on the bottom-right corner is the app's signature shape. The rule is checkable in two seconds:

**Solid fill → cut. Everything else → rounded.**

- **Gets the cut:** the solid-fill Button variants — `default`, `secondary`, and `destructive` (a solid red fill; destructive commits share the family shape) — everywhere they appear: page CTAs, dialog submits, delete confirms, the top-bar primary, the header's Sign in. Implemented once, in `buttonVariants` (`apps/web/src/components/ui/button.tsx`) via the `btn-corner-cut` utility (`apps/web/src/index.css`); size variants tune `--btn-cut` (8px default, 5px for `xs`/`sm`/`icon-xs`/`icon-sm`).
- **Stays rounded:** `outline` (bordered, and the border would die on the clip edge — see below), `ghost`, links, inputs, selects, dialogs, cards, badges, and — for now — `Toggle` pressed states (a known, accepted inconsistency; revisit if it grates).
- **Segmented selectors** (one active option out of a joined row: group-by, time range, price source, validity filter) are `ToggleGroup` with `variant="outline" spacing={0}`, never a `ButtonGroup` whose active member switches to `variant="default"`. A cut fires on the active segment wherever it sits, so an interior selection loses its bottom-right corner with no outer edge to justify it, and `rounded-none` fights the group's end rounding. `ToggleGroup` marks the active segment with a `bg-muted` fill and handles the first/last radii itself. Reference: the validity filter in `apps/web/src/features/decks/components/deck-list-toolbar.tsx`. The card-browser toolbars are the exception: they use `variant="control"` (see "The control surface").
- **Pairing rule:** next to a cut CTA, the lesser action is `ghost` (borderless, visibly a different species), not `outline` — in dark mode `outline` gains a tinted fill and masquerades as a clashing rounded peer. Reserve `outline` for form-adjacent contexts away from cut buttons.
- **Scaled-up kin:** the landing hero CTAs (12px cut at h-11) and the landing vignette frames / toolbox tiles (16px / 12px) use the same shape at marketing scale, hand-rolled at their call sites.

Technical constraints the cut brings, already handled where it applies:

- `clip-path` clips outset box-shadows, so cut buttons use **inset focus rings** (`focus-visible:ring-inset`).
- A stroked border on the clip boundary anti-aliases away at fractional zoom. Filled buttons have no border, so this never bites them. If a _bordered_ surface ever needs the cut, use the clipped-wrapper hairline construction (outer element in the line color, inner inset by 1px, both clipped) — see the landing page's "Sign up free" CTA.

## Color tokens

The palette lives in `apps/web/src/index.css`; components only ever name a token. Two rules keep the scheme coherent:

- **Every surface carries the ground's hue.** In the dark scheme the background is navy (hue 260) and every surface, border and text token (`--card`, `--popover`, `--muted`, `--secondary`, `--border`, `--input`, `--foreground`, `--muted-foreground`) sits on the same hue at a low chroma. A neutral value (chroma 0) on any of them reads as a gray slab on a blue ground; that was the source of the "gray" feel before the pass. The light scheme is warm parchment (hue 85) with cool navy text; keep that pairing.
- **State is a semantic token, never a Tailwind hue.** `success`, `warning`, `info`, `destructive` and `violet` each ship as a solid (`text-success`, `bg-warning`, `border-info/30`), a soft fill (`bg-success-soft`) and, for the four states, a foreground for text on the solid (`text-success-foreground`). Each token already differs between light and dark, so a `dark:` variant next to a token class is a bug. `violet` is the fourth taxonomy tone (rules-change "moved", the admin role chip), not a state. Gold accents use `--border-accent` (`text-border-accent`, `ring-border-accent`). Raw hue classes (`text-green-600`, `bg-amber-500/10`, `text-sky-400`) are banned by `apps/web/src/lib/design-guards.test.ts`; the only exemptions are physical card stock and photo backdrops (`bg-neutral-800`), the podium medals, domain colors (through `@/lib/domain`) and the rarity lens hexes.

- **Status text is never a painted sentence.** A red, green or amber paragraph is not a pattern. Block status goes in `Alert`; a one-line status next to a control is `text-muted-foreground` with the hue on a leading icon only. A soft fill (`bg-warning-soft`) always pairs with its own hue text (`text-warning`), never inherited foreground. Text on a solid state fill is that fill's `-foreground` token: light on dark fills, a darker shade of the same hue on light fills.

- **Inline links are `TextLink`** (`components/ui/text-link.tsx`): `default` is primary-colored with underline on hover, `muted` is muted-foreground, always underlined, foreground on hover. `inherit` keeps the surrounding text color and underlines on hover, for an entity name (card, deck, player, set) that is a link inside a table cell, hero or list row. `Button variant="link"` / `"link-muted"` are the same two recipes for button-shaped call sites. Never hand-write `text-primary hover:underline`.

`--accent` equals `--primary` in this theme. It is the brand fill, never a hover or highlight wash: menus, list rows and toggles highlight with `bg-muted`.

## Edges and elevation

- **One edge color.** Cards, list panels, popovers and dialogs draw their edge as `ring-1 ring-border`; inputs, outline buttons and alerts draw a `border` in the same `--border` token. There is no second edge color (the old `ring-foreground/10` was a cool gray line that clashed with the warm border in light mode and with the navy in dark).
- **Two elevation tiers.** Anchored popups (popover, hover card, select, dropdown and context menus including sub-menus, combobox, navigation menu, chart tooltip) cast `shadow-md`. Modals and edge panels (dialog, alert dialog, drawer, sheet) cast `shadow-lg`. Tooltips cast none. Content surfaces (cards, tiles) cast none at rest; a hoverable tile may lift to `shadow-md`.
- **Focus** is `focus-visible:ring-2 focus-visible:ring-ring/50` everywhere, inset on cut buttons.

## The control surface

The card-browser toolbars — the search row and the compact filter bar on `/cards`, `/collections` and the deck list — sit on one fill ladder, the `control` variant of `Button` and `Toggle`. Four neutral steps, each `foreground` at one alpha over whatever surface the control is on:

| state                  | class                                          |
| ---------------------- | ---------------------------------------------- |
| rest                   | `bg-foreground/5` with `border-input`          |
| hover, or popover open | `bg-foreground/10`                             |
| active (`data-active`) | `bg-foreground/16` plus `border-foreground/50` |
| active and hovered     | `bg-foreground/24`                             |

Because `foreground` moves away from the page in both themes, one class is correct in light and dark, and a `dark:` variant next to a control fill is a bug. Active means a filter is carrying a value; set it as `data-active={isActive || undefined}` so the attribute is absent when false (`data-active="false"` still matches the selector). Grouped controls (icon clusters, segmented toggles) take the fill only — their shared borders cannot carry the active edge. Excluded values keep the destructive tint (`bg-destructive/10`, `border-destructive/40`, `text-destructive`); a zero count is `opacity-40` over the rest fill, never a different fill.

Text entry sits on the same rest fill, so `Input`, `Textarea`, `InputGroup`, `Select`, `Checkbox`, `RadioGroup` and `InputOTP` carry `bg-foreground/5` in both themes and mark disabled with opacity alone. `outline` keeps its own `dark:bg-input/30` fill and stays the default for buttons and toggles everywhere else. `/admin/design` → Controls renders every variant against every state, with the resolved colors measured live.

## Washes and selection

- **Row hover** is `hover:bg-muted/50` on list rows and tiles, `hover:bg-muted` on menu items, ghost buttons and toggles. No other alpha. The `control` variant's ladder below is the one exception, and it is not a row wash.
- **Inset panels** (a note callout, a muted band, a code chip) use `bg-muted/30` when bordered and `bg-muted` when not. `bg-muted/40`, `/60`, `/80` are not tiers.
- **Selection** is `ring-2 ring-primary` for the chosen item and `ring-2 ring-primary/60` for a drop target, with `ring-offset-2 ring-offset-background` when the ring must clear an image. `border-primary` and `bg-primary/10` mark a chosen option inside a form, not a selected tile.

## Radius

`--radius` is `0.375rem` (sharpened from the shadcn default `0.625rem`) — every rounded control derives from it. Don't hand-tune radii per component; if something looks off, the token is the discussion, not the call site.

The mapping: `rounded-lg` (6px) for every boxed control and surface (button, input, select, card, popover, dialog, tile), `rounded-md` (4px) for things nested inside one (menu items, tab triggers, table cells, inline code, thumbnails in a row), `rounded-sm` (2px) for kbd and hairline chips, `rounded-4xl` for pills (badge, count pill), `rounded-full` for dots and avatars. Bare `rounded` is Tailwind's 0.25rem and does not follow the token; the guard test rejects it, write `rounded-md`. Arbitrary values (`rounded-[4px]`) are for container-query units only.

## Control rows

Boxed controls that share a horizontal row share a height. The form tier is **h-8**, and it's the default for all three box primitives — `Input`, `SelectTrigger`, and `Button` — so a row of defaults is always aligned. The compact sizes (`sm` h-7, `xs` h-6) exist for uniformly-dense surfaces (table rows, chip strips, toolbars where _everything_ is compact), not for "slightly smaller CTA": never put a compact bordered/filled button in the same row as an h-8 box — the edges misalign by 4-8px and read as broken. Borderless controls (ghost icon buttons, links) are exempt; with no visible box edge they may sit one tier smaller inside a taller row. A button that belongs _to_ an input (clear, submit-inline) goes inside `InputGroup` as `InputGroupButton`, which locks the sizing structurally. The "Control row" demo on `/admin/design` shows the aligned reference row.

A settings row (label, optional description, control on the trailing edge) is `SettingsRow` (`components/layout/settings-row.tsx`). The control slot is an h-8 row, so switches, selects, segmented radios and buttons all sit on the same line and every row has the same pitch. Reorderable lists (marketplaces, languages) keep their buttons rendered and disabled instead of removing them, so rows never change height.

## Accents

- **Gold hairlines** (`--border-accent`): the emphasis border — landing vignette frames, the hero's outline CTA. Use sparingly; it marks crafted moments, not generic borders.
- **The card-border rule** (`OrnamentRule`, `apps/web/src/components/ui/ornament.tsx`): the gold hairline with a diamond gem, taken from the edge of the printed card text box. It replaces every bare gold heading rule: fading at both ends at `w-40` under marketing and landing headings and at `w-56` under a centered heading or above the footer, and edge to edge with only the tips fading (`fade="tips"`) and a label between two gems for the card-grid set headers and the `SettingsGroup` labels on settings pages. `align="start"` drops the leading line and the closing gem so the label sits on the left edge with the rule running out from it, and `trailing` puts counts or controls on the far edge; that is the deck page's zone header. Where the header folds, the leading gem is the toggle (`OrnamentFoldGem`, or `ExpandToggle chevron="gem"`), so the fold cue and the ornament are one glyph. The same file holds `OrnamentBase` (the bracket base with stepped caps and a medallion), which closes the card detail text box with the rarity glyph in the medallion, and `OrnamentCorners` (chamfered corner brackets, on a `ClipFrame` via `ornament`), demoed on `/admin/design` and not yet placed. `tone="silver"` exists for the black stage ground only. Gold ornaments go only where the gold hairline already goes: never on Card edges, inputs, tables or menus.
- **Display face** (`font-heading`, Chakra Petch): see `typography.md` for the exact scope (titles, wordmark, big numerals — never body or compact UI).

## Spacing and alignment

The type scale is fixed; so is the spacing scale. Pick a tier, never a number between two tiers.

| tier | class    | where                                                                                                                              |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 4px  | `gap-1`  | inside a control: icon to label, a title to its description (`CardHeader`, `DialogHeader`, `SheetHeader`, `FieldContent`, `Alert`) |
| 8px  | `gap-2`  | label to field, rows in a `RowList`, chips in a strip, buttons in an action row                                                    |
| 16px | `gap-4`  | fields inside a `SettingsSection`, tiles in a grid, the padding inside a `Card`, dialog or `Callout`                               |
| 24px | `gap-6`  | a heading to its content (`SettingsSection` title to fields, `SettingsGroup` rule to its first section)                            |
| 32px | `gap-8`  | section to section (`SettingsGroup`), a page description to the first block                                                        |
| 40px | `gap-10` | group to group (`SettingsLayout`), the blocks of a long page, above a page footer                                                  |

The page gutter is `px-safe` (12px on phones, 24px from `sm`, 32px from `lg`), never a hard-coded `px-N` on a page column; the design-guard test rejects `PAGE_WIDTH` paired with one.

Three rules decide how the tiers combine:

- **Inner space is smaller than outer space.** The gap between a heading and its content is smaller than the gap between two sections, and the gap between rows in a list is smaller than the gap around the list. A stack whose gap equals its children's gap reads as one flat list. Check every new stack top-down: heading to content, then siblings, then section to section, each one tier up.
- **Whitespace separates; edges do not.** A hairline is drawn in exactly these places: the global header's bottom edge, a table header's rule, the totals rule on `TableFooter`, the rows of `RowList variant="divided"` and `Table variant="divided"`, `divide-y` between rows inside a `Card`, the full-width rail an underline tab strip sits on, and a real spreadsheet grid. A `<Separator>` between sibling sections, a `border-t` above a footer or a "load more" button, a `border-l` standing in for an indent, and a `bg-muted` band as a group header are all spacing jobs: delete the edge and take the next tier up. The design-guard test rejects `<Separator>` outside `components/ui`.
- **When in doubt, take the larger tier.** Cramped is the common failure; too generous is rare. `gap-2` between unrelated groups and `p-2`/`p-3` on a bordered surface are the usual signs.

Alignment follows from the same primitives:

- **Mixed sizes share a baseline.** A label beside a larger value sits in an `items-baseline` row with the non-text children (`IconChip`, a chevron, a button) on `self-center`. `StatTile`, `ActionBand`, `StatStrip` and `deck-hero.tsx` are the reference; a `text-xs` label vertically centered against a `text-sm` value is the anti-pattern.
- **Padded elements align by their visible edge.** A ghost button or padded row link next to flush text pulls itself out by its own padding (`-ml-2` on an h-8 ghost icon button, `-mx-2 px-2` on `RowListLink`, `-ml-1.5` on an icon-sm button) so the glyph or label edge lands on the column. The sort header of a padded row list carries the same negative margin as its rows.
- **Icons sit on the text's optical center**: `items-center` in a row of same-size text, `self-center` in a baseline row, `*:[svg]:translate-y-0.5` beside a title as `Alert` does. An icon-plus-label chip that sits in running text or a baseline row is `inline-flex items-baseline gap-1` with the icon on `self-center` and the label in its own span, so the chip's baseline is the label's, never the icon's bottom edge. Never `align-text-bottom` on an inline icon.
- **Body text is left-aligned.** Centering is for a heading plus one short line: a hero, an empty state title, the footer link row. A paragraph that can wrap past two lines is never centered; if it must sit in a centered composition it is a left-aligned block (`mx-auto max-w-prose text-left`).

## When not to box

A box (a `Card` ring, a border, a filled panel) means one of three things: an entity in a grid or list (a deck, a group, a tournament, a printing), a popup or modal, or a destructive boundary (a danger zone). Everything else gets structure from typography and spacing, not from an edge. Concretely:

- **A settings or form section** is a `SettingsSection` (`components/layout/settings-section.tsx`): title, one-line description, fields. Siblings sit inside `SettingsGroup`, which separates them by spacing (`gap-8`) under an uppercase group label set into an `OrnamentRule` (the same labelled gold rule as the card-grid set headers); a page with more than three sections gets groups and a `SettingsLayout` table of contents (the profile and group manage pages). There are no plain hairlines between sections or groups. One box per settings page at most, the destructive one, so the box keeps its meaning.
- **A list or table under a `SectionHeading`** is flat: `RowList` / `RowListItem` / `RowListLink` (`components/ui/row-list.tsx`) or a bare `Table`. A headerless `Card` around a `<ul>` or a `<Table>` is the anti-pattern; the design-guard test rejects `py-0` / `p-0` Cards outside the listed exemptions. Rows separate by spacing and, when clickable, by the hover wash; there are no hairlines between rows by default. `RowList variant="divided"` adds them and is for tall multi-line rows only (a submission with several lines). The same rule applies to `Table`: rows carry no hairline by default, `variant="divided"` opts in for tall rows.
- **A number** is a figure with a label. `StatStrip` items draw no edge. `StatTile` is for a number that navigates somewhere, and an overview page carries at most one `ActionBand`, the one waiting on the viewer.
- **A note inside another surface** (a Card, a dialog, a form) is `Callout variant="inset"`: a borderless muted band. One edge per surface; rows inside a Card separate with `divide-y`, never with a second bordered box.
- **Copy that renders on every visit** is prose (`PageDescription`, or a muted paragraph), not an `Alert` or `Callout`. Those two are for a state that appeared.

## Tiles and list rows

Entity tiles and list rows (a deck, group, trade, member, tournament, stat block) use the **`Card` primitive**, not hand-rolled `bg-card rounded-* border` divs — hand-rolled boxes drift from the Card look (corner radius, ring-vs-border) the moment tokens change. For clickable rows, the Link/button stays the outer element (`className="block"`) with the Card nested inside carrying the visuals.

Two list shapes carry the Card edge without being a `Card`, and both have a primitive in `components/ui/card-list.tsx`. **`CardList`** is one panel with its rows flush inside it, separated by their own hover wash — a rail whose edge does layout work because it sits beside a grid. **`CardRow`** is a standalone bordered row in a gapped list, for rows that stand apart because each is its own entity with its own actions (a bye, a team). They are alternatives, not a pair: a `CardRow` never goes inside a `CardList`. Reach for `Card` itself as soon as the thing has a header, a footer, or real content padding. The default list shape is neither: a list under a heading is a flat `RowList` (see "When not to box").

Hand-rolled containers remain correct for: sticky toolbars and page chrome, form option-groups inside dialogs, diagram/mock frames (see `typography.md`), interactive gesture surfaces (match tracker), and deliberately custom marketing surfaces (landing page).

## Callouts, notes and code

`Alert` is the icon + title + description callout (`default`, `destructive`, `warning`, `info`) for a state that appeared. `Callout` (`components/ui/callout.tsx`) is the muted note box for anything with its own inner layout: the dismissable intro guide, option asides; `variant="inset"` is the borderless form for a note inside a Card, dialog or form. `Code` (`components/ui/code.tsx`) is the inline chip for a path, key or command in help copy. Section labels above a list are `SectionHeading`, never a hand-typed uppercase span; the tracking is `tracking-wide`, there is no `wider` or `widest` tier.

## Empty states

Use `EmptyState` (`apps/web/src/components/empty-state.tsx`) — the dashed card-fan visual — for genuinely-empty surfaces. Filtered-empty ("nothing matches your filters") stays a quiet description-only `Empty`. Don't hand-roll bare-paragraph empty states.
