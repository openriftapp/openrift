/**
 * 32-bit FNV-1a over the string's UTF-16 code units.
 * @returns The hash as an unsigned 32-bit integer.
 */
export function fnv1a(text: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < text.length; index++) {
    // oxlint-disable-next-line unicorn/prefer-code-point -- FNV-1a hashes UTF-16 units
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01_00_01_93);
  }
  return hash >>> 0;
}
