import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FieldValues, UseFormSetError } from "react-hook-form";

import { authClient } from "@/features/account/lib/auth-client";
import { setServerError } from "@/lib/auth-errors";
import { sessionQueryOptions } from "@/lib/auth-session";

type UserPatch = Parameters<typeof authClient.updateUser>[0];

interface AuthServerError {
  code?: string;
  message?: string;
}

export function useUpdateUserField<TValues extends FieldValues>(
  form: { setError: UseFormSetError<TValues> },
  options: { saveFailed: string; onServerError?: (error: AuthServerError) => void },
) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();
  const onServerError = options.onServerError ?? ((error) => setServerError(form, error));

  async function save(patch: UserPatch) {
    setLoading(true);
    setSuccess(false);
    const result = await authClient.updateUser(patch).catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: options.saveFailed });
      return;
    }
    if (result.error) {
      onServerError(result.error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    setSuccess(true);
  }

  return { save, loading, success };
}
