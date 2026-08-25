/**
 * Ownership / authorization helpers.
 *
 * These centralize the "a student may only touch their own documents" rule so
 * every route enforces it the same way. This is the primary defense against
 * IDOR: never fetch a resource by id alone — always constrain by owner (or
 * verify ownership after fetching).
 */

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Assert that a fetched resource belongs to the acting user. Admins pass.
 * Returns the resource (narrowed non-null) or throws.
 *
 * Prefer scoping the query itself (e.g. `where: { id, ownerId }`) — use this
 * as a defense-in-depth check when a resource was fetched by id.
 */
export function assertOwnership<T extends { ownerId: string }>(
  resource: T | null | undefined,
  user: { id: string; role: string },
): T {
  if (!resource) throw new NotFoundError();
  if (resource.ownerId !== user.id && user.role !== "ADMIN") {
    // Do not leak existence: treat as not-found to the caller if desired,
    // but here we surface Forbidden for internal clarity.
    throw new ForbiddenError();
  }
  return resource;
}
