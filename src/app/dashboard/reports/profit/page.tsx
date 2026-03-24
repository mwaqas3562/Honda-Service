"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  FileText,
  Percent,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { formatRs, LoadingSpinner } from "@/components/DrillDown";
import { today, monthStart, getDatePresets, parseDateParams } from "@/lib/report-filters";

/* ─── Types ───────────────────────────────────── */

interface Invoice {
  id: number;
  date: string;
  jobNo: string | null;
  customer: string;
  labour: number;
  parts: number;
  discount: number;
  billAmount: number;
  cost: number;
  profit: number;
}

interface Totals {
  labour: number;
  parts: number;
  discount: number;
  billAmount: number;
  cost: number;
  profit: number;
  expenses: number;
  netProfit: number;
  invoiceCount: number;
  profitPct: number;
}

type Preset = { label: string; from: string; to: string };

/* ─── Component ──────────────────────────────── */

function ProfitReportPageContent() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const urlDates = parseDateParams(sp, monthStart(), today());

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(urlDates.from);
  const [dateTo, setDateTo] = useState(urlDates.to);
  const [activePreset, setActivePreset] = useState(urlDates.fromUrl ? "" : "This Month");

  const presets = getDatePresets();

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const res = await fetch(`/api/reports/profit?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
        setTotals(data.totals);
      } else {
        toast("Failed to load profit report", "error");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast("Network error", "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, toast]);

  useEffect(() => {
    const c = new AbortController();
    fetchData(c.signal);
    return () => c.abort();
  }, [fetchData]);

  function applyPreset(p: Preset) {
    setDateFrom(p.from);
    setDateTo(p.to);
    setActivePreset(p.label);
  }

  function exportCSV() {
    if (invoices.length === 0) return;
    const header = "Inv No,Job No,Customer,Labour,Parts,Discount,Bill Amount,Cost,Profit";
    const rows = invoices.map(
      (inv) =>
        `INV-${inv.id},${inv.jobNo || ""},${`"${inv.customer.replace(/"/g, '""')}"`},${inv.labour},${inv.parts},${inv.discount},${inv.billAmount},${inv.cost},${inv.profit}`
    );
    // Add totals row
    if (totals) {
      rows.push(
        `Grand Total,,,${totals.labour},${totals.parts},${totals.discount},${totals.billAmount},${totals.cost},${totals.profit}`
      );
    }
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit_report_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit Report"
        description="Accounting-style invoice-level profit breakdown"
      />

      {/* ─── Filters ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activePreset === p.label
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePreset("");
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePreset("");
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={invoices.length === 0}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ─── Invoice Table ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="py-20" />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mb-3" />
            <p className="font-medium">No invoices found</p>
            <p className="text-sm">Try changing the date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Inv No
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Job No
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Customer
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Labour
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Parts
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Discount
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Bill Amount
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Cost
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900">
                      INV-{inv.id}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 font-mono">
                      {inv.jobNo || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900">
                      {inv.customer}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-gray-700">
                      {inv.labour > 0 ? formatRs(inv.labour) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-gray-700">
                      {inv.parts > 0 ? formatRs(inv.parts) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-gray-500">
                      {inv.discount > 0 ? formatRs(inv.discount) : "0"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-900">
                      {formatRs(inv.billAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-orange-600">
                      {formatRs(inv.cost)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right text-sm font-bold ${
                        inv.profit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatRs(inv.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* ─── Grand Total Footer (sticky) ─── */}
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td
                    colSpan={3}
                    className="px-3 py-3 text-sm font-bold text-gray-800"
                  >
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-800">
                    {totals ? formatRs(totals.labour) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-800">
                    {totals ? formatRs(totals.parts) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-800">
                    {totals ? formatRs(totals.discount) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                    {totals ? formatRs(totals.billAmount) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-orange-600">
                    {totals ? formatRs(totals.cost) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-bold ${
                      totals && totals.profit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {totals ? formatRs(totals.profit) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ─── Summary Section (accounting style) ─── */}
      {totals && !loading && invoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
            {/* Left column — breakdown */}
            <div className="space-y-2">
              <SummaryRow label="Total Labour" value={totals.labour} />
              <SummaryRow label="Total Parts" value={totals.parts} />
              <SummaryRow label="Total Discount" value={totals.discount} />
              <div className="border-t border-gray-200 pt-2 mt-2">
                <SummaryRow label="Total Sale" value={totals.billAmount} bold />
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <SummaryRow
                  label="Total Cost of Sale"
                  value={totals.cost}
                  color="text-orange-600"
                />
              </div>
            </div>

            {/* Right column — profit calculations */}
            <div className="space-y-2">
              <div className="border-b border-gray-200 pb-2 mb-2">
                <SummaryRow
                  label="Total Profit"
                  value={totals.profit}
                  bold
                  color={totals.profit >= 0 ? "text-green-600" : "text-red-600"}
                />
              </div>

              <SummaryRow
                label="Expenses"
                value={totals.expenses}
                color="text-red-500"
              />

              <div className="border-t-2 border-gray-300 pt-3 mt-3">
                <SummaryRow
                  label="Net Profit"
                  value={totals.netProfit}
                  bold
                  large
                  color={totals.netProfit >= 0 ? "text-green-600" : "text-red-600"}
                />
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-dashed border-gray-200">
                <Percent className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600">Profit %</span>
                <span className="ml-auto text-sm font-bold text-blue-600">
                  {totals.profitPct}%
                </span>
              </div>
            </div>
          </div>

          {/* ─── Validation ─── */}
          <div className="mt-4 pt-3 border-t border-dashed border-gray-200 text-xs text-gray-400 space-y-1">
            <div className="flex items-center gap-1">
              {totals.profit === totals.billAmount - totals.cost ? (
                <TrendingUp className="h-3 w-3 text-green-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400" />
              )}
              <span>
                Total Profit ({formatRs(totals.profit)}) = Total Sale (
                {formatRs(totals.billAmount)}) − Cost ({formatRs(totals.cost)})
              </span>
            </div>
            <div className="flex items-center gap-1">
              {totals.netProfit === totals.profit - totals.expenses ? (
                <TrendingUp className="h-3 w-3 text-green-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400" />
              )}
              <span>
                Net Profit ({formatRs(totals.netProfit)}) = Total Profit (
                {formatRs(totals.profit)}) − Expenses ({formatRs(totals.expenses)})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Summary Row ─── */

function SummaryRow({
  label,
  value,
  bold,
  large,
  color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  large?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-sm ${bold ? "font-semibold text-gray-800" : "text-gray-600"}`}
      >
        {label}
      </span>
      <span
        className={`${large ? "text-lg" : "text-sm"} ${
          bold ? "font-bold" : "font-medium"
        } ${color || "text-gray-900"}`}
      >
        {formatRs(value)}
      </span>
    </div>
  );
}
export default function ProfitReportPage() {
  return (
    <Suspense>
      <ProfitReportPageContent />
    </Suspense>
  );
}