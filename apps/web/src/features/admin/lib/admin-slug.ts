import { kebabKeyRegex, slugRegex } from "@openrift/shared/contracts/admin/shared";

export function isValidSlug(value: string): boolean {
  return slugRegex.test(value);
}

export function isValidKebabKey(value: string): boolean {
  return kebabKeyRegex.test(value);
}
