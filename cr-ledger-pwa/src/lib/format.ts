// src/lib/format.ts

export function shortKey(s: string, head = 20): string {
  if (!s) return "";
  if (s.length <= head) return s;
  return `${s.slice(0, head)}...`;
}

export function pct(x: number): string {
  if (!Number.isFinite(x)) return "-";
  const v = x * 100;
  return `${v.toFixed(1)}%`;
}

export function int(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return String(Math.trunc(n));
}

export function num(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}
