import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("s3curePassw0rd");
    expect(hash).not.toBe("s3curePassw0rd");
    expect(await verifyPassword("s3curePassw0rd", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3curePassw0rd");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
