import { cardTypeSchema, domainSchema, imageIdSchema } from "@openrift/shared/response-schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const errataAnnouncementSchema = z.object({
  id: z.string().meta({ examples: ["019f2a10-5c1e-7d4f-9a62-1b3c4d5e6f70"] }),
  name: z.string().meta({ examples: ["Vendetta Errata Updates"] }),
  /** `YYYY-MM-DD` */
  publishedOn: z.string().meta({ examples: ["2026-07-23"] }),
  url: z.string().meta({
    examples: ["https://playriftbound.com/en-us/news/announcements/vendetta-errata-updates/"],
  }),
});

export const errataEntrySchema = z.object({
  announcementId: z
    .string()
    .nullable()
    .meta({ examples: ["019f2a10-5c1e-7d4f-9a62-1b3c4d5e6f70"] }),
  source: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  sourceUrl: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  /** `YYYY-MM-DD` */
  effectiveDate: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  correctedRulesText: z
    .string()
    .nullable()
    .meta({ examples: ["When I win a combat, play a Gold gear token exhausted."] }),
  correctedEffectText: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  card: z.object({
    slug: z.string().meta({ examples: ["draven-vanquisher"] }),
    name: z.string().meta({ examples: ["Draven, Vanquisher"] }),
    types: z.array(cardTypeSchema),
    tags: z.array(z.string()),
    domains: z.array(domainSchema),
  }),
  printing: z
    .object({
      shortCode: z.string().meta({ examples: ["SFD-020"] }),
      setSlug: z.string().meta({ examples: ["SFD"] }),
      printedRulesText: z.string().nullable(),
      printedEffectText: z.string().nullable(),
      imageId: imageIdSchema.nullable(),
    })
    .nullable(),
});

export const errataListResponseSchema = z.object({
  announcements: z.array(errataAnnouncementSchema),
  sets: z.array(z.object({ slug: z.string(), name: z.string() })),
  entries: z.array(errataEntrySchema),
});

export const errataContract = {
  list: oc
    .route({ method: "GET", path: "/api/v1/errata", tags: ["Errata"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .output(errataListResponseSchema),
};

export type ErrataListResponse = z.infer<typeof errataListResponseSchema>;
export type ErrataEntry = z.infer<typeof errataEntrySchema>;
export type ErrataAnnouncement = z.infer<typeof errataAnnouncementSchema>;
