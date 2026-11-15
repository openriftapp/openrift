// Sentry v11's `dataCollection` defaults collect user info, cookies, request
// bodies and query data; these are the v10 defaults with `sendDefaultPii` off.
// Dependency-free so instrument.server.mjs can import it before anything else.

const SENSITIVE_KEYS = ["forwarded", "-ip", "remote-", "via", "-user"];

// A natively submitted account form lands these in the query until the app redirects.
const FORM_QUERY_KEYS = [
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "email",
  "redirect",
];

export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: SENSITIVE_KEYS },
    response: { deny: SENSITIVE_KEYS },
  },
  httpBodies: [],
  urlQueryParams: { deny: [...SENSITIVE_KEYS, ...FORM_QUERY_KEYS] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
};
