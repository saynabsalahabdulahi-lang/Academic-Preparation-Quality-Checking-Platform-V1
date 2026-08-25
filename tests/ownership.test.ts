import { describe, it, expect } from "vitest";
import {
  assertOwnership,
  ForbiddenError,
  NotFoundError,
} from "@/lib/auth/ownership";

const doc = { ownerId: "user-a", id: "doc-1" };

describe("assertOwnership (IDOR defense)", () => {
  it("allows the owner", () => {
    expect(assertOwnership(doc, { id: "user-a", role: "STUDENT" })).toBe(doc);
  });

  it("blocks a different user (User B cannot access User A's document)", () => {
    expect(() =>
      assertOwnership(doc, { id: "user-b", role: "STUDENT" }),
    ).toThrow(ForbiddenError);
  });

  it("allows an admin", () => {
    expect(assertOwnership(doc, { id: "admin", role: "ADMIN" })).toBe(doc);
  });

  it("throws NotFound for a missing resource", () => {
    expect(() =>
      assertOwnership(null, { id: "user-a", role: "STUDENT" }),
    ).toThrow(NotFoundError);
  });
});
