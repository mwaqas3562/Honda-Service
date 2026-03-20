"use client";

import React from "react";

/* ─── formatRs ────────────────────────────────────
   Shared currency formatter.
   Handles negative values (e.g. -500 → "-Rs 500"). */
export function formatRs(n: number) {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? "-" : ""}Rs ${abs.toLocaleString()}`;
}

/* ─── formatDate ──────────────────────────────────
   Default: day + month + year (no time).
   Pass options to customise. */
export function formatDate(d: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString("en-PK", opts ?? {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ─── formatDateFull ──────────────────────────────
   Weekday + day + month + year. Appends T00:00:00 to
   avoid timezone shift on date-only strings (YYYY-MM-DD). */
export function formatDateFull(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ─── formatDateTime ──────────────────────────────
   Day + month + year + time (hour:minute). */
export function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── DetailSection ───────────────────────────────
   Collapsible section wrapper with icon + color theme. */

export type SectionColor = "green" | "blue" | "red" | "orange" | "emerald" | "purple" | "gray";

const bgMap: Record<SectionColor, string> = {
  green: "bg-green-50", blue: "bg-blue-50", red: "bg-red-50",
  orange: "bg-orange-50", emerald: "bg-emerald-50", purple: "bg-purple-50", gray: "bg-gray-50",
};
const txtMap: Record<SectionColor, string> = {
  green: "text-green-600", blue: "text-blue-600", red: "text-red-600",
  orange: "text-orange-600", emerald: "text-emerald-600", purple: "text-purple-600", gray: "text-gray-600",
};

export function DetailSection({ title, icon: Icon, color, count, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: SectionColor;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg ${bgMap[color]} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${txtMap[color]}`} />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400">({count})</span>
      </div>
      {children}
    </div>
  );
}

/* ─── EmptyState ─────────────────────────────────── */

export function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg">{text}</p>;
}

/* ─── PayBadge ───────────────────────────────────── */

export function PayBadge({ type }: { type: string }) {
  const cls =
    type === "credit" ? "bg-yellow-100 text-yellow-700" :
    type === "card" ? "bg-purple-100 text-purple-700" :
    "bg-gray-100 text-gray-600";
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{type}</span>;
}

/* ─── StatusBadge ────────────────────────────────── */

export function StatusBadge({ status }: { status: string }) {
  const cls =
    (status === "final" || status === "completed" || status === "received")
      ? "bg-green-100 text-green-700"
      : (status === "draft" || status === "pending" || status === "open")
      ? "bg-yellow-100 text-yellow-700"
      : "bg-gray-100 text-gray-600";
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{status}</span>;
}

/* ─── TypeBadge ──────────────────────────────────── */

const defaultTypeBadge: Record<string, { label: string; cls: string }> = {
  sale: { label: "Sale", cls: "bg-green-100 text-green-700" },
  service: { label: "Service", cls: "bg-blue-100 text-blue-700" },
  purchase: { label: "Purchase", cls: "bg-orange-100 text-orange-700" },
  jobcard: { label: "Job Card", cls: "bg-purple-100 text-purple-700" },
};

export function TypeBadge({ type, config }: { type: string; config?: Record<string, { label: string; cls: string }> }) {
  const badge = (config ?? defaultTypeBadge)[type] ?? { label: type, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

/* ─── ItemsTable ─────────────────────────────────
   Standard parts/items table used in invoice details,
   daily-cash drill-down, customer timeline expansion. */

export interface TableItem {
  name: string;
  partNumber?: string;
  qty: number;
  price: number;
  total: number;
}

export function ItemsTable({ items, label, color = "gray" }: {
  items: TableItem[];
  label?: string;
  color?: "gray" | "purple";
}) {
  if (items.length === 0) return null;

  const border = color === "purple" ? "border-purple-200" : "border-gray-200";
  const headBg = color === "purple" ? "bg-purple-50/50" : "bg-gray-50";
  const headTxt = color === "purple" ? "text-purple-600" : "text-gray-600";
  const rowBorder = color === "purple" ? "border-purple-50" : "border-gray-50";
  const rowHover = color === "purple" ? "hover:bg-purple-50/30" : "hover:bg-gray-50/40";
  const numTxt = color === "purple" ? "text-purple-400" : "text-gray-400";
  const nameTxt = color === "purple" ? "text-purple-800" : "text-gray-900";
  const priceTxt = color === "purple" ? "text-purple-600" : "text-gray-600";
  const totalTxt = color === "purple" ? "text-purple-800" : "text-gray-900";
  const qtyTxt = color === "purple" ? "text-purple-700" : "text-gray-700";

  const showPartNumber = items.some((i) => i.partNumber);

  return (
    <div>
      {label && (
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {label} ({items.length})
        </h4>
      )}
      <div className={`border ${border} rounded-lg overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`${headBg} border-b ${border}`}>
              <th className={`text-left px-4 py-2 text-xs font-semibold ${headTxt}`}>#</th>
              <th className={`text-left px-4 py-2 text-xs font-semibold ${headTxt}`}>Item</th>
              {showPartNumber && (
                <th className={`text-left px-4 py-2 text-xs font-semibold ${numTxt}`}>Part #</th>
              )}
              <th className={`text-center px-3 py-2 text-xs font-semibold ${headTxt} w-16`}>Qty</th>
              <th className={`text-right px-3 py-2 text-xs font-semibold ${headTxt} w-24`}>Price</th>
              <th className={`text-right px-4 py-2 text-xs font-semibold ${headTxt} w-28`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className={`border-b ${rowBorder} ${rowHover}`}>
                <td className={`px-4 py-2 text-xs ${numTxt}`}>{i + 1}</td>
                <td className={`px-4 py-2 font-medium ${nameTxt}`}>{it.name}</td>
                {showPartNumber && (
                  <td className={`px-4 py-2 text-xs ${numTxt} font-mono`}>{it.partNumber}</td>
                )}
                <td className={`px-3 py-2 text-center ${qtyTxt}`}>{it.qty}</td>
                <td className={`px-3 py-2 text-right ${priceTxt}`}>{formatRs(it.price)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${totalTxt}`}>{formatRs(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── InvoiceTotals ──────────────────────────────
   Right-aligned summary showing subtotal/labour/discount/total. */

export function InvoiceTotals({ subtotal, laborCost, discount, total, totalColor }: {
  subtotal?: number | null;
  laborCost?: number | null;
  discount?: number | null;
  total: number;
  totalColor?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="space-y-1.5 text-sm max-w-xs ml-auto">
        {subtotal != null && subtotal !== total && (
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{formatRs(subtotal)}</span>
          </div>
        )}
        {laborCost != null && laborCost > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Labour Cost</span>
            <span className="text-gray-900">{formatRs(laborCost)}</span>
          </div>
        )}
        {discount != null && discount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Discount</span>
            <span className="text-red-600">-{formatRs(discount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
          <span className="font-bold text-gray-900">Total</span>
          <span className={`font-bold text-lg ${totalColor ?? "text-green-700"}`}>
            {formatRs(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── InfoRow ────────────────────────────────────
   Icon + label + value row for detail header cards. */

export function InfoRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-4 h-4 text-gray-400" />
      <span className="text-gray-500">{label}:</span>
      {children}
    </div>
  );
}

/* ─── LoadingSpinner ─────────────────────────────── */

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className ?? "py-16"}`}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
    </div>
  );
}
