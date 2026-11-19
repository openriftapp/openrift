import type {
  apiKeyCreatedResponseSchema,
  apiKeyResponseSchema,
  apiKeysResponseSchema,
  createApiKeySchema,
} from "@openrift/shared/contracts/api-keys";
import type { z } from "zod";

export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;

export type ApiKeysResponse = z.infer<typeof apiKeysResponseSchema>;

export type ApiKeyCreatedResponse = z.infer<typeof apiKeyCreatedResponseSchema>;

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
