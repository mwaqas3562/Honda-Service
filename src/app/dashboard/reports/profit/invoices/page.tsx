"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Download,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Receipt,
  TrendingUp,
  TrendingDown,
  Package,
  Hammer,
  FileText,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import {
  formatRs,
  formatDateTime,
  PayBadge,
  StatusBadge,
  LoadingSpinner,
} from "@/components/DrillDown";
import { today, monthStart, getDatePresets, parseDateParams } from "@/lib/report-filters";

/* ─── Types ───────────────────────────────────── */

interface InvoiceItem {
  name: string;
  partNumber: string;
  quantity: number;
  salePrice: number;
  salePriceTotal: number;
  purchaseCost: number;
  purchaseCostTotal: number;
  profit: number;
}

interface LabourItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: number;
  date: string;
  customer: string;
  saleAmount: number;
  purchaseCost: number;
  labourTotal: number;
  profit: number;
  discount: number;
  paymentType: string;
  status: string;
  itemCount: number;
  items: InvoiceItem[];
  labourItems: LabourItem[];
}

interface InvoiceSummary {
  customerName: string;
  invoiceCount: number;
  totalSales: number;
  totalPurchaseCost: number;
  totalLabour: number;
  totalProfit: number;
}

type Preset = { label: string; from: string; to: string };

/* ─── Component ──────────────────────────────── */

function InvoiceProfitPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const sp = useSearchParams();

  const customer = sp.get("customer") || "";
  const urlDates = parseDateParams(sp, monthStart(), today());

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [dateFrom, setDateFrom] = useState(urlDates.from);
  const [dateTo, setDateTo] = useState(urlDates.to);
  const [activePreset, setActivePreset] = useState(urlDates.fromUrl ? "" : "This Month");

  const presets = getDatePresets();

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!customer) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        customer,
        from: dateFrom,
        to: dateTo,
      });
      const res = await fetch(`/api/reports/profit/invoices?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
        setSummary(data.summary);
      } else {
        toast("Failed to load invoice data", "error");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast("Network error", "error");
    } finally {
      setLoading(false);
    }
  }, [customer, dateFrom, dateTo, toast]);

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

  function toggleExpand(id: number) {
    setExpandedId(expandedId === id ? null : id);
  }

  function exportCSV() {
    if (invoices.length === 0) return;
    const header = "Invoice #,Date,Items,Sale Amount,Purchase Cost,Labour,Profit";
    const rows = invoices.map(
      (inv) =>
        `INV-${inv.id},${new Date(inv.date).toLocaleDateString()},${inv.itemCount},${inv.saleAmount},${inv.purchaseCost},${inv.labourTotal},${inv.profit}`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_profit_${customer}_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const profitMargin =
    summary && summary.totalSales > 0
      ? ((summary.totalProfit / summary.totalSales) * 100).toFixed(1)
      : "0.0";

  const kpiCards = [
    {
      label: "Total Sales",
      value: summary ? formatRs(summary.totalSales) : "—",
      icon: ShoppingCart,
      color: "blue",
      sub: `${summary?.invoiceCount ?? 0} invoices`,
    },
    {
      label: "Purchase Cost",
      value: summary ? formatRs(summary.totalPurchaseCost) : "—",
      icon: Receipt,
      color: "orange",
      sub: "COGS",
    },
    {
      label: "Labour Income",
      value: summary ? formatRs(summary.totalLabour) : "—",
      icon: Hammer,
      color: "purple",
      sub: "Pure profit",
    },
    {
      label: "Net Profit",
      value: summary ? formatRs(summary.totalProfit) : "—",
      icon: summary && summary.totalProfit >= 0 ? TrendingUp : TrendingDown,
      color: summary && summary.totalProfit >= 0 ? "green" : "red",
      sub: `${profitMargin}% margin`,
    },
  ];

  const kpiColorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    orange: "border-orange-200 bg-orange-50",
    purple: "border-purple-200 bg-purple-50",
    red: "border-red-200 bg-red-50",
    green: "border-green-200 bg-green-50",
  };
  const kpiTextMap: Record<string, string> = {
    blue: "text-blue-600",
    orange: "text-orange-600",
    purple: "text-purple-600",
    red: "text-red-600",
    green: "text-green-600",
  };

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <FileText className="h-12 w-12 mb-3" />
        <p className="font-medium">No customer selected</p>
        <button
          onClick={() => router.push("/dashboard/reports/profit/customers")}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
        >
          Go to Customer Profit Report
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice Profit — ${customer}`}
        description="Invoice-level profit breakdown with item details"
        action={
          <button
            onClick={() => router.push(`/dashboard/reports/profit/customers?from=${dateFrom}&to=${dateTo}`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Customers
          </button>
        }
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

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`rounded-xl border p-4 ${kpiColorMap[c.color]}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${kpiTextMap[c.color]}`} />
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
              <p className={`text-lg font-bold ${kpiTextMap[c.color]}`}>{c.value}</p>
              <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
            </div>
          );
        })}
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="w-8" />
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Invoice #
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Date
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Items
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Sale Amount
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Purchase Cost
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Labour
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                    Profit
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const isExpanded = expandedId === inv.id;
                  return (
                    <InvoiceRow
                      key={inv.id}
                      invoice={inv}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(inv.id)}
                    />
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td />
                  <td className="px-3 py-3 text-sm font-semibold text-gray-700">
                    Total ({invoices.length})
                  </td>
                  <td />
                  <td className="px-3 py-3 text-center text-sm font-medium text-gray-600">
                    {invoices.reduce((s, i) => s + i.itemCount, 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                    {summary ? formatRs(summary.totalSales) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-orange-600">
                    {summary ? formatRs(summary.totalPurchaseCost) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-purple-600">
                    {summary ? formatRs(summary.totalLabour) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-bold ${
                      summary && summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {summary ? formatRs(summary.totalProfit) : "—"}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Invoice Row (with expandable item detail) ─── */

function InvoiceRow({
  invoice,
  isExpanded,
  onToggle,
}: {
  invoice: Invoice;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-gray-50 cursor-pointer transition-colors group"
      >
        <td className="pl-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
          )}
        </td>
        <td className="px-3 py-3 text-sm font-medium text-gray-900">
          INV-{invoice.id}
        </td>
        <td className="px-3 py-3 text-sm text-gray-600">
          {formatDateTime(invoice.date)}
        </td>
        <td className="px-3 py-3 text-center text-sm text-gray-600">
          {invoice.itemCount}
        </td>
        <td className="px-3 py-3 text-right text-sm font-medium text-gray-900">
          {formatRs(invoice.saleAmount)}
        </td>
        <td className="px-3 py-3 text-right text-sm text-orange-600">
          {formatRs(invoice.purchaseCost)}
        </td>
        <td className="px-3 py-3 text-right text-sm text-purple-600">
          {formatRs(invoice.labourTotal)}
        </td>
        <td
          className={`px-4 py-3 text-right text-sm font-bold ${
            invoice.profit >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatRs(invoice.profit)}
        </td>
        <td className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <StatusBadge status={invoice.status} />
            <PayBadge type={invoice.paymentType} />
          </div>
        </td>
      </tr>

      {/* ─── Expanded Item Details ─── */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="bg-gray-50/70 px-6 py-4">
            <div className="space-y-4">
              {/* Parts items */}
              {invoice.items.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Parts ({invoice.items.length})
                    </h4>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">
                            Item
                          </th>
                          <th className="text-left text-xs font-medium text-gray-400 px-3 py-2">
                            Part #
                          </th>
                          <th className="text-center text-xs font-medium text-gray-500 px-3 py-2 w-14">
                            Qty
                          </th>
                          <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-24">
                            Sale Price
                          </th>
                          <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-28">
                            Sale Total
                          </th>
                          <th className="text-right text-xs font-medium text-orange-500 px-3 py-2 w-28">
                            Cost/Unit
                          </th>
                          <th className="text-right text-xs font-medium text-orange-500 px-3 py-2 w-28">
                            Cost Total
                          </th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 py-2 w-28">
                            Profit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {invoice.items.map((item, i) => (
                          <tr key={i} className="hover:bg-white/60">
                            <td className="px-4 py-2 font-medium text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400 font-mono">
                              {item.partNumber}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {formatRs(item.salePrice)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">
                              {formatRs(item.salePriceTotal)}
                            </td>
                            <td className="px-3 py-2 text-right text-orange-500">
                              {formatRs(item.purchaseCost)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-orange-600">
                              {formatRs(item.purchaseCostTotal)}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-bold ${
                                item.profit >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {formatRs(item.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100/50 border-t border-gray-200">
                          <td
                            colSpan={4}
                            className="px-4 py-2 text-xs font-semibold text-gray-500"
                          >
                            Parts Subtotal
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                            {formatRs(
                              invoice.items.reduce((s, it) => s + it.salePriceTotal, 0)
                            )}
                          </td>
                          <td />
                          <td className="px-3 py-2 text-right text-sm font-bold text-orange-600">
                            {formatRs(
                              invoice.items.reduce((s, it) => s + it.purchaseCostTotal, 0)
                            )}
                          </td>
                          <td
                            className={`px-4 py-2 text-right text-sm font-bold ${
                              invoice.items.reduce((s, it) => s + it.profit, 0) >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatRs(
                              invoice.items.reduce((s, it) => s + it.profit, 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Labour items */}
              {invoice.labourItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Hammer className="h-4 w-4 text-purple-500" />
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Labour ({invoice.labourItems.length}) — 100% Profit
                    </h4>
                  </div>
                  <div className="border border-purple-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-purple-50/50 border-b border-purple-200">
                          <th className="text-left text-xs font-medium text-purple-600 px-4 py-2">
                            Labour
                          </th>
                          <th className="text-center text-xs font-medium text-purple-600 px-3 py-2 w-14">
                            Qty
                          </th>
                          <th className="text-right text-xs font-medium text-purple-600 px-3 py-2 w-24">
                            Rate
                          </th>
                          <th className="text-right text-xs font-medium text-purple-600 px-4 py-2 w-28">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-50">
                        {invoice.labourItems.map((li, i) => (
                          <tr key={i} className="hover:bg-purple-50/30">
                            <td className="px-4 py-2 font-medium text-purple-800">
                              {li.name}
                            </td>
                            <td className="px-3 py-2 text-center text-purple-700">
                              {li.quantity}
                            </td>
                            <td className="px-3 py-2 text-right text-purple-600">
                              {formatRs(li.unitPrice)}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-purple-800">
                              {formatRs(li.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Invoice profit summary */}
              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Sale Total</p>
                    <p className="font-bold text-gray-900">
                      {formatRs(invoice.saleAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Purchase Cost</p>
                    <p className="font-bold text-orange-600">
                      {formatRs(invoice.purchaseCost)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Labour</p>
                    <p className="font-bold text-purple-600">
                      {formatRs(invoice.labourTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net Profit</p>
                    <p
                      className={`font-bold text-lg ${
                        invoice.profit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatRs(invoice.profit)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function InvoiceProfitPage() {
  return (
    <Suspense>
      <InvoiceProfitPageContent />
    </Suspense>
  );
}
