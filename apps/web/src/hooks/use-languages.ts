import { adminLanguagesContract } from "@openrift/shared/contracts/admin/languages";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { createAdminEnumHooks } from "@/lib/create-admin-enum-hooks";
import { adminLanguagesQueryOptions } from "@/lib/languages-queries";
import { initKeys } from "@/lib/query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const createLanguageFn = createServerFn({ method: "POST" })
  .validator(
    (input: { code: string; name: string; color?: string | null; sortOrder?: number }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminLanguagesContract, context.cookie).create(data);
  });

const updateLanguageFn = createServerFn({ method: "POST" })
  .validator(
    (input: { code: string; name?: string; color?: string | null; sortOrder?: number }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminLanguagesContract, context.cookie).update(data);
  });

const reorderLanguagesFn = createServerFn({ method: "POST" })
  .validator((input: { codes: string[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminLanguagesContract, context.cookie).reorder({ codes: data.codes });
  });

const deleteLanguageFn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminLanguagesContract, context.cookie).remove({ code: data.code });
  });

const languageHooks = createAdminEnumHooks({
  listQueryOptions: adminLanguagesQueryOptions,
  invalidates: [adminKeys.languages, initKeys.all],
  create: (vars: { code: string; name: string; color?: string | null; sortOrder?: number }) =>
    createLanguageFn({ data: vars }),
  update: (vars: { code: string; name?: string; color?: string | null; sortOrder?: number }) =>
    updateLanguageFn({ data: vars }),
  reorder: (codes: string[]) => reorderLanguagesFn({ data: { codes } }),
  remove: (code: string) => deleteLanguageFn({ data: { code } }),
});

export const useLanguages = languageHooks.useList;
export const useCreateLanguage = languageHooks.useCreate;
export const useUpdateLanguage = languageHooks.useUpdate;
export const useReorderLanguages = languageHooks.useReorder;
export const useDeleteLanguage = languageHooks.useDelete;
