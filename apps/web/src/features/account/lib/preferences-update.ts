import type { preferencesContract } from "@openrift/shared/contracts/preferences";
import type { UserPreferencesResponse } from "@openrift/shared/types/api/preferences";
import type { ContractRouterClient } from "@orpc/contract";

/** A null value tells the API to remove the key, resetting it to the default. */
export type PreferencesUpdateInput = Parameters<
  ContractRouterClient<typeof preferencesContract>["update"]
>[0];

/**
 * The cached preferences after a saved update: keys the update reset to the default leave the
 * cache, and keys it does not name, such as server-only ones, stay.
 */
export function mergeSavedPreferences(
  previous: UserPreferencesResponse | undefined,
  saved: PreferencesUpdateInput,
): UserPreferencesResponse {
  const merged: UserPreferencesResponse = { ...previous };
  for (const key of Object.keys(saved) as (keyof PreferencesUpdateInput)[]) {
    const value = saved[key];
    if (value === null) {
      // oxlint-disable-next-line typescript/no-dynamic-delete -- the key is one of the update's own fields
      delete merged[key];
    } else if (value !== undefined) {
      Object.assign(merged, { [key]: value });
    }
  }
  return merged;
}
