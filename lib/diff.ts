/**
 * Lightweight word-level diff for the Original vs Revised comparison view.
 * Uses a longest-common-subsequence backtrace to classify each token as
 * unchanged, added, or removed. Pure and deterministic (easy to test).
 */

export type DiffOp = { type: "equal" | "insert" | "delete"; text: string };

// Split into words while keeping whitespace as its own tokens, so spacing is
// preserved when rendering.
function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

export function diffWords(original: string, revised: string): DiffOp[] {
  const a = tokenize(original);
  const b = tokenize(revised);
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(ops, "equal", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(ops, "delete", a[i]);
      i++;
    } else {
      push(ops, "insert", b[j]);
      j++;
    }
  }
  while (i < n) push(ops, "delete", a[i++]);
  while (j < m) push(ops, "insert", b[j++]);

  return ops;
}

// Merge consecutive ops of the same type for compact output.
function push(ops: DiffOp[], type: DiffOp["type"], text: string) {
  const last = ops[ops.length - 1];
  if (last && last.type === type) last.text += text;
  else ops.push({ type, text });
}
