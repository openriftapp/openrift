# Browser Extension

`apps/extension` is a cross-browser extension (Chrome MV3, Firefox) that sends the decklist the user is viewing on an external deck site to OpenRift, and shows their collection and wishlist counts on Cardmarket seller offers. It is built with [WXT](https://wxt.dev/) and shares the deck text codec with the rest of the monorepo through `@openrift/shared/deck-codecs`.

## Design

The extension is deliberately minimal.

- **`activeTab`, no host permissions by default.** Clicking the toolbar icon opens a popup, and each of its actions injects into that one tab, once. The Cardmarket feature below adds optional host permissions, granted from the popup or the options page.
- **Thin extractor.** The injected script reads the decklist (card names, quantities, zones) from the DOM; parsing, matching, and saving happen on the OpenRift side.
- **Hand-off by deep link.** The result opens `https://openrift.app/decks/import?code=<payload>` in a new tab, where the user reviews the parse and saves. The import works logged-out (browser-local deck, claimed on login).

It imports the deck the user is looking at.

## How it works

The popup injects `src/entrypoints/extract.content.ts` via `browser.scripting.executeScript` (WXT `registration: "runtime"`) as it opens, on any page that could hold a deck, and receives the extraction result as the script's return value. Extraction lives in `src/lib/deck-extract.ts` and tries, in order:

1. **Structured decklist table**
2. **Sectioned card-name list**
3. **Deck code fallback** — a Piltover Archive deck code found in the page URL (path/query/hash), in code-ish elements (`code`, `pre`, inputs, anything with "code" in a class name), or in link targets. Candidates are verified with a real decode via `isDeckCode`, so plausible-looking words don't match.

Unknown labels (card-type groupings like `unit`/`spell`) fold into the main deck. Sideboard lists are kept separate.

If nothing matches, the popup shows no Deck Import section at all. The import itself spends no second injection: it sends what the detection already found.

A deck name rides along: the page's `h1` is passed as `&name=` and prefills the deck-name field on the review step.

So does the page's own address, as `&source=`, which the review step offers as an outbound deck link on the imported deck. Deck links are restricted to the allowlist in `packages/shared/src/link-hosts.ts`, so `src/lib/source-link.ts` drops anything not on it (along with `utm_*`-style tracking tags) rather than sending a link the import page would refuse. The URL is read in the page by the content script, not from `tab.url`, so it needs no permission beyond the injection itself. The import page re-checks it against `deckLinkSchema` regardless — the param is whatever the address bar says — and shows it as a removable chip, since a deck's links are public on its share page. Replace mode ignores it and keeps the target deck's own links.

The import page's `?code=` parameter sniffs the payload format itself (`parseDeckImportAuto` in `apps/web/src/features/decks/lib/deck-import-parsers.ts`), so text lists and compact codes both work in the same deep link.

## Cardmarket wishlist counts

The second feature annotates a Cardmarket seller's offers with how many copies the user owns and how many are on the wishlists they picked. Cardmarket's own API is closed to new applicants, so everything runs in the browser under the user's own session.

**The data never travels from Cardmarket to OpenRift.** OpenRift hands the extension a snapshot and matching happens in the page:

1. The user opens `/extension/cardmarket` on OpenRift, where every wishlist starts picked. The page renders the counts into a `<script type="application/json" data-openrift-overlay-snapshot>` block: one row per Cardmarket product id and finish with `owned` and `wanted`, summed across the picked lists.
2. `capture-snapshot.content.ts` waits for that block (the page renders data-only, so it appears well after the document completes) and writes it to `browser.storage.local` itself. The background script confirms the capture by the stored timestamp changing, because an async content script's return value does not survive injection on every build.
3. On a seller's offers page, `annotate.content.ts` reads the stored snapshot, resolves each article row to a Cardmarket product id, and marks the row twice: a pill next to the product link for what the viewer owns and wants, and the viewer's own marketplace price next to the seller's asking price. A row the snapshot does not cover gets neither, since a wrong `own 0` reads as a fact.

The seller's own asking price is coloured against that reference: green at or under it, amber up to a fifth over, red past that. Cardmarket sells in euro, so a TCGplayer reference is shown but never compared. Prices are read off the row with `parsePriceCents`, which handles both orders Cardmarket prints (`1.234,56 €` and `€1,234.56`), and the colour is an inline style on Cardmarket's own element, tracked by an attribute so a later pass can take it back.

The reference price is the headline price of the marketplace sitting first in the viewer's marketplace order, which the sync page sends with the request. It is the price OpenRift shows for the card elsewhere, taken from the EN printing behind the product and falling back to the cheapest mapped printing. Rows therefore cover every mapped Cardmarket product, not only the ones the viewer owns or wants, which is why the popup counts only the latter when it reports what it holds.

Cardmarket products are language-aggregate but exist once per finish, so a snapshot row is keyed by product id **and** finish, and the owned count spans every language and condition of the printings behind it. One product sits in front of several printings (the language variants), so the counting query dedupes a list entry per product row or a want of 6 would come back as 24.

**Permissions.** A plain install still asks for nothing beyond `activeTab`: the host permissions for `www.cardmarket.com` and the OpenRift instance are optional, asked for from the popup or the options page, and a fresh install opens the options page so the ask is not buried. Without them the feature still works one page at a time through the popup, which is what `activeTab` grants. With them, the background script annotates offers pages as they finish loading and re-captures the snapshot whenever the sync page is opened, so nothing needs clicking at all.

The popup is a header and up to three sections, each present only when it has something to say. **Cardmarket** always shows: the synchronized lists with their entry counts and a "Last sync" line, or the setup when nothing has been synchronized yet. **Picked for a list** appears while the basket holds picks. **Deck Import** appears only when the detection above found a deck, and names it. The primary action comes from the page the popup opens over (`popup-actions.ts`): on the sync page it takes the counts as it opens, so the click on the icon is the whole interaction; on a seller's offers page it marks the page and a quieter "Synchronize" sits beside it; anywhere else it synchronizes, which opens the sync page in a background tab, waits for the hand-off and closes it again. The permission request appears until it is granted.

Entry counts ride along in the snapshot (`cardmarketOverlayListSchema`), counted from the same rule-expanded entries the wants come from, so a rule-driven list reports what the snapshot actually covers. The field is optional on the extension side: a snapshot captured before the site sent it still loads, without the counts.

**Picking cards for a list.** The same offers page can be shopped from: `annotate.content.ts` also puts a `+` / count / `−` control on every row with a product id (`cardmarket-pick-controls.ts`), whether or not a snapshot exists. Picks live in `browser.storage.local` under one basket keyed by seller and then by `(product id, finish, language id)` (`picks.ts`), the background script mirrors the total onto the toolbar badge, and the popup lists each seller with a "Send to OpenRift" and a "Clear" button. Sending opens `/collections/lists/import/cardmarket` with the payload JSON in the URL **fragment** (`picksImportUrl`), which never reaches the server and has no practical length cap, and removes that seller's picks from the basket. The page resolves each pick through `POST /api/v1/cardmarket/picks/resolve`, which reads `(idProduct, finish, idLanguage)` to a printing through `marketplace_product_variants` (the same resolver the stock sync uses, minus the condition), and hands the result to the collection import preview so unmatched picks can be fixed or skipped by hand. Saving creates or appends to a printing-kind organize list. The payload shape is `PicksPayload` in the extension and the zod schema in `apps/web/src/features/extension/lib/cardmarket-picks-payload.ts`; bump `v` on both sides when it changes.

**Row extraction is markup-dependent**, and `cardmarket-rows.ts` holds every assumption, written against a saved offers page:

- Rows are `div[id^="stockRow"]`, also carrying `class="article-row"`. The id is the article id, not the product id.
- The row exposes the product id nowhere except the thumbnail tooltip, whose `data-bs-title` holds an `<img>` tag pointing at `product-images.s3.cardmarket.com/<n>/<SET>/<idProduct>/<idProduct>.jpg`. That folder name is the join key.
- Foil is a `span.st_SpecialIcon` labelled `Foil`. The `isFoil` parameter on the product link is the page's own filter state and says nothing about the article, so it is not read.
- The language is a `span.icon` whose `aria-label` (or `data-bs-original-title`) names the language in the interface language, "Englisch" on a German UI. `cardmarket-language.ts` maps the label to Cardmarket's numeric language id by stem; a label it cannot place leaves the pick's language open and the server reports it as not placeable.
- The pill goes after the product link in `.col-seller`.

When Cardmarket changes any of that, fix it there and update the fixture rows in `cardmarket-rows.test.ts`.

## Development

```bash
bun run --cwd apps/extension dev            # Chrome dev mode with HMR
bun run --cwd apps/extension dev:firefox    # Firefox dev mode
bun run --cwd apps/extension build          # production build (.output/chrome-mv3)
bun run --cwd apps/extension build:firefox  # production build (.output/firefox-mv2)
bun run --cwd apps/extension zip            # store-ready zips for both browsers
bun run --cwd apps/extension test src/lib/deck-extract.test.ts
```

To point a local build at a dev instance, set `WXT_OPENRIFT_URL` in `apps/extension/.env` (see `src/lib/openrift-url.ts`). Pass it in the shell as well when the OpenRift host permission has to follow (`WXT_OPENRIFT_URL=https://localhost:5174 bun run --cwd apps/extension build:firefox`): `wxt.config.ts` computes that manifest entry before Vite loads `.env`, so the file alone moves the bundled URL but leaves the manifest pointing at production.

To load an unpacked build: Chrome → `chrome://extensions` → Developer mode → "Load unpacked" → `.output/chrome-mv3`. Firefox → `about:debugging` → "Load Temporary Add-on" → any file in `.output/firefox-mv2`.

## Distribution

**Firefox is the only published build.** AMO signs it through its _unlisted_ channel and hands the `.xpi` back for us to host. Signing is automated, usually a couple of minutes, with no human review. Firefox itself has no equivalent of Chrome's unlisted store listing: on AMO, "unlisted" means self-hosted, and the choice is binary.

Users install from one permanent URL:

```plaintext
https://github.com/openriftapp/openrift/releases/download/extension-updates/openrift-deck-importer.xpi
```

Every release re-uploads the signed build there under that fixed name, next to the update manifest, so nothing on the site needs updating when a version ships. AMO names the signed file after the version, which is why this renamed copy exists at all. The name lives in three places that cannot import from each other: `LATEST_XPI_FILE` in `src/lib/firefox-distribution.ts`, `LATEST_XPI` in the release workflow, and `SOCIAL_LINKS.extensionDownload` in `apps/web/src/lib/social-links.ts`.

**Chrome is not distributed.** The MV3 build exists and can be loaded unpacked (see Development above), but it is published nowhere, so there is no way for a user to install it. Whenever that changes it has to go through the Web Store: Chrome has hard-blocked off-store `.crx` installs on Windows and macOS since 2015, and every version is reviewed, which would make it the slower of the two channels by a wide margin.

### Releasing the Firefox build

1. Bump `version` in `apps/extension/package.json`. AMO signs each version exactly once, so a reused version fails the release.
2. Run the **Release Extension** workflow (`.github/workflows/release-extension.yml`) from the Actions tab.

It tests, builds, signs via AMO, generates the update manifest, and publishes two releases:

- `ext-v<version>` — the signed `.xpi` under AMO's own file name. Immutable, one per version.
- `extension-updates` — the update manifest plus a copy of the same `.xpi` as `openrift-deck-importer.xpi`, both rewritten in place every release.

Both are created with `--latest=false` so `semantic-release` keeps the repo's "latest release" pointer for the app.

Installed copies poll the manifest roughly every 24 hours; `about:addons` → Check for Updates forces it.

### Why a fixed tag

`update_url` is baked into every installed copy and an install can only learn a new location by first updating through the old one. So the URL can never change, and the manifest cannot live at `releases/latest/download/…` — GitHub's "latest release" is a single per-repo pointer that `semantic-release` claims on every app release, which would 404 the manifest as soon as the next app version shipped.

Hence the fixed `extension-updates` tag. **Do not delete that release or rename either asset.** Every installed copy polls the manifest, including ones dormant for months, and the site's install link points at the `.xpi` beside it.

### Required secrets

`AMO_JWT_ISSUER` and `AMO_JWT_SECRET`, from the [AMO API credentials page](https://addons.mozilla.org/developers/addon/api/key/). The account needs 2FA enabled, and must be the one that owns the `extension@openrift.app` add-on id.

### Migrating to an AMO listing

Later, the extension can move to a public AMO listing without anyone reinstalling. AMO allows listed and unlisted versions under one add-on id, and an extension with no `update_url` falls back to AMO's update service keyed by that id. That is the whole mechanism.

Order matters:

1. **Get the listed version approved first**, with `update_url` removed from the manifest (AMO rejects it on listed versions). Doing this before step 2 matters — flipping testers over while review is pending strands them on a build with no update source at all.
2. **Ship one final self-distributed build with `update_url` removed**, through the existing `extension-updates` manifest.
3. Firefox finds no update source in that build, asks AMO, and pulls the higher listed version. Migration done in a day or two.

Version numbers are unique across both channels on one id, and the listed version must be higher — e.g. self-hosted `0.4.0` → transition `0.4.1` → listed `0.5.0`. Don't burn a high number on the self-hosted side.

Keep the `extension-updates` release alive well past the switch. Someone who hasn't opened Firefox in months still polls it on next launch, and a 404 strands that install permanently.

## Adding support for another site

If the site embeds a standard deck code in its URLs or pages, no work is needed. Otherwise add an extractor function to `src/lib/deck-extract.ts` and call it from `extractDeckFromPage` before the code fallback. Extractors match on markup shape and come with tests (see `deck-extract.test.ts` for the fixture style).
