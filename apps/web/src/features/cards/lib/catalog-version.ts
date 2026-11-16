export function versionFromEtag(etagHeader: string | null): string | null {
  if (etagHeader === null) {
    return null;
  }
  const version = etagHeader.replace(/^W\//u, "").replaceAll('"', "");
  return version === "" ? null : version;
}
