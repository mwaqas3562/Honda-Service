/**
 * Shared utility functions used across the application.
 */

/** Convert Prisma Decimal (or any value) to a plain number for arithmetic */
export function n(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

/** Round a number to 2 decimal places */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format a number as Pakistani Rupees (e.g. "Rs 1,234") */
export function fmtRs(v: number | unknown): string {
  return `Rs ${Math.round(Number(v)).toLocaleString()}`;
}
