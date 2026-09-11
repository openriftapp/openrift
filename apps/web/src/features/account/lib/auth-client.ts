import { apiKeyClient } from "@better-auth/api-key/client";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL =
  "location" in globalThis ? globalThis.location.origin : process.env.API_INTERNAL_URL;

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    emailOTPClient(),
    apiKeyClient(),
    // Mirrors user.additionalFields in apps/api/src/auth.ts; keep in sync.
    inferAdditionalFields({
      user: {
        riotId: { type: "string", required: false },
        bio: { type: "string", required: false },
        profileShowRiotId: { type: "boolean", required: false },
        profileShowCollection: { type: "boolean", required: false },
        profileShowLastActive: { type: "boolean", required: false },
      },
    }),
  ],
});

export const { signIn, signUp, signOut } = authClient;
