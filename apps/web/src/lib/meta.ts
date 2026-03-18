/**
 * Default document head metadata — mirrors what's currently in index.html.
 * Ready to plug into TanStack Start's `routeOptions.head` or a `<Meta>`
 * component when the migration happens.
 */
export const defaultMeta = {
  title: "OpenRift",
  description: "Fast. Open. Ad-free. A Riftbound companion.",
  themeColor: "#1d1538",
  icons: {
    favicon: "/favicon-64x64.png",
    appleTouchIcon: "/apple-touch-icon-180x180.png",
    logo: "/logo.webp",
  },
  verification: {
    impact: "5a360cf2-9e98-4886-8c05-4e2e1a39ce0e",
  },
  preconnect: ["https://cmsassets.rgpub.io"],
} as const;
