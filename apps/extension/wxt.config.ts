import { defineConfig } from "wxt";

import { CARDMARKET_MATCH_PATTERN } from "./src/lib/cardmarket-url";
import { ADDON_ID, UPDATE_MANIFEST_URL } from "./src/lib/firefox-distribution";
import { openriftMatchPattern } from "./src/lib/openrift-url";

export default defineConfig({
  srcDir: "src",
  // oxlint needs explicit imports; auto-import hides each identifier's origin from it.
  imports: false,
  manifest: ({ browser }) => ({
    name: "OpenRift Companion",
    description:
      "Send decklists to OpenRift, see your collection and wishlist counts on Cardmarket, and pick cards from a seller for a list.",
    permissions: ["activeTab", "scripting", "storage"],
    // Granted from the options page, so a plain install still asks for no host
    // access. MV2 has no separate optional host list.
    ...(browser === "firefox"
      ? { optional_permissions: [CARDMARKET_MATCH_PATTERN, openriftMatchPattern()] }
      : { optional_host_permissions: [CARDMARKET_MATCH_PATTERN, openriftMatchPattern()] }),
    options_ui: { page: "options.html", open_in_tab: true },
    // Drop update_url when migrating to an AMO-listed add-on: AMO rejects it
    // on listed versions. See docs/extension.md.
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: { id: ADDON_ID, update_url: UPDATE_MANIFEST_URL },
      },
    }),
  }),
});
