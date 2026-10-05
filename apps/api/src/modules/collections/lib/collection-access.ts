import { ERROR_CODES } from "@openrift/shared/error-codes";

import type { Repos } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import type { CollectionAccess } from "../repositories/collections.js";

/** A collection the viewer neither owns nor shares through a group is a 404. */
export async function loadCollectionAccess(
  repos: Repos,
  collectionId: string,
  userId: string,
): Promise<CollectionAccess> {
  const access = await repos.collections.getAccessForUser(collectionId, userId);
  assertFound(access, "Not found");
  return access;
}

/** `action` completes "Only admins can …" in the 403 message. */
export async function requireCollectionAdmin(
  repos: Repos,
  collectionId: string,
  userId: string,
  action: string,
): Promise<CollectionAccess> {
  const access = await loadCollectionAccess(repos, collectionId, userId);
  if (!access.viewerCanAdmin) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, `Only admins can ${action}`);
  }
  return access;
}

type CopyWithCollection = Awaited<ReturnType<Repos["copies"]["listWithCollectionContext"]>>[number];

/** 404 when any copy is missing, 403 when any sits in a collection the viewer cannot write. */
export async function loadWritableCopies(
  repos: Repos,
  userId: string,
  copyIds: string[],
): Promise<CopyWithCollection[]> {
  const copies = await repos.copies.listWithCollectionContext(copyIds);
  if (copies.length !== copyIds.length) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "One or more copies not found");
  }
  const sourceIds = [...new Set(copies.map((row) => row.collectionId))];
  const writableSources = await repos.collections.filterWritableByViewer(sourceIds, userId);
  if (writableSources.length !== sourceIds.length) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "One or more copies are not writable by you");
  }
  return copies;
}
