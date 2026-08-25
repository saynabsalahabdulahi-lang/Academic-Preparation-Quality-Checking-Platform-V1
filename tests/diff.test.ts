import { describe, it, expect } from "vitest";
import { diffWords } from "@/lib/diff";

function reconstruct(ops: ReturnType<typeof diffWords>, side: "a" | "b") {
  return ops
    .filter((o) =>
      side === "a" ? o.type !== "insert" : o.type !== "delete",
    )
    .map((o) => o.text)
    .join("");
}

describe("word diff", () => {
  it("marks identical text as all equal", () => {
    const ops = diffWords("the cat sat", "the cat sat");
    expect(ops.every((o) => o.type === "equal")).toBe(true);
  });

  it("reconstructs both original and revised from the ops", () => {
    const original = "The research is very important and useful.";
    const revised = "The research is significant and highly useful.";
    const ops = diffWords(original, revised);
    expect(reconstruct(ops, "a")).toBe(original);
    expect(reconstruct(ops, "b")).toBe(revised);
  });

  it("detects insertions and deletions", () => {
    const ops = diffWords("a b c", "a x c");
    expect(ops.some((o) => o.type === "delete" && o.text.includes("b"))).toBe(
      true,
    );
    expect(ops.some((o) => o.type === "insert" && o.text.includes("x"))).toBe(
      true,
    );
  });
});
