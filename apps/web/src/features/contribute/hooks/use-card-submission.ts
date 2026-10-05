import { cardSubmissionsContract } from "@openrift/shared/contracts/card-submissions";
import type { CardSubmissionInput } from "@openrift/shared/contracts/card-submissions";
import { createServerFn } from "@tanstack/react-start";

import { cardSubmissionsKeys } from "@/features/contribute/lib/contribute-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const submitCardFn = createServerFn({ method: "POST" })
  .validator((input: CardSubmissionInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(cardSubmissionsContract, context.cookie).submit(data);
  });

/** On the daily-cap or validation paths, the thrown error's message is contributor-facing and can be shown directly. */
export function useSubmitCard() {
  return useMutationWithInvalidation({
    mutationFn: async (input: CardSubmissionInput) => {
      await submitCardFn({ data: input });
    },
    invalidates: [cardSubmissionsKeys.root],
  });
}
