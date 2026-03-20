/**
 * Centralized date-filter helpers shared by all report pages.
 * Import from "@/lib/report-filters" to avoid duplicating logic.
 */

/* ─── Date helpers ───────────────────────────── */

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

export function monthEnd(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
}

/* ─── Quick presets (shared by Transactions & Daily Cash) ── */

export interface DatePreset {
  label: string;
  from: string;
  to: string;
}

export function getDatePresets(): DatePreset[] {
  const now = new Date();
  const t = today();
  const ms = monthStart();
  const me = monthEnd();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const dow = now.getDay() || 7;
  const ws = new Date(now);
  ws.setDate(now.getDate() - dow + 1);

  return [
    { label: "Today", from: t, to: t },
    { label: "This Week", from: ws.toISOString().split("T")[0], to: t },
    { label: "This Month", from: ms, to: me },
    { label: "Last Month", from: lm.toISOString().split("T")[0], to: lmEnd.toISOString().split("T")[0] },
  ];
}

/* ─── URL search-param parser ────────────────── */

/**
 * Parse `from` & `to` query params from a URLSearchParams instance.
 * Returns the param values if present, otherwise falls back to `defaultFrom` / `defaultTo`.
 * When both defaults are omitted the fallback is today.
 */
export function parseDateParams(
  sp: URLSearchParams,
  defaultFrom?: string,
  defaultTo?: string,
): { from: string; to: string; fromUrl: boolean } {
  const f = sp.get("from");
  const t = sp.get("to");
  const fromUrl = !!(f || t);
  return {
    from: f || defaultFrom || today(),
    to: t || defaultTo || today(),
    fromUrl,
  };
}
