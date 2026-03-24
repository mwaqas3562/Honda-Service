"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Receipt,
  Users,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  Hammer,
  Package,
  FileText,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import {
  formatRs,
  formatDateTime,
  LoadingSpinner,
  PayBadge,
  StatusBadge,
} from "@/components/DrillDown";
import { today, monthStart, getDatePresets, parseDateParams } from "@/lib/report-filters";

/* ─── Types ───────────────────────────────────── */

interface CustomerProfit {
  customerName: string;
  totalSales: number;
  totalPurchaseCost: number;
  labourIncome: number;
  profit: number;
  profitPct: number;
  invoiceCount: number;
}

interface Summary {
  totalSales: number;
  totalPurchaseCost: number;
  partsProfit: number;
  totalLabourIncome: number;
  totalExpenses: number;
  netProfit: number;
  customerCount: number;
}

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

type SortKey = "profit" | "totalSales" | "profitPct";
type SortDir = "asc" | "desc";

type Preset = { label: string; from: string; to: string };

/* ─── Component ──────────────────────────────── */

function CustomerProfitPageContent() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const urlDates = parseDateParams(sp, monthStart(), today());

  const [customers, setCustomers] = useState<CustomerProfit[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(urlDates.from);
  const [dateTo, setDateTo] = useState(urlDates.to);
  const [activePreset, setActivePreset] = useState(urlDates.fromUrl ? "" : "This Month");

  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Drill-down state
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const presets = getDatePresets();

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setExpandedCustomer(null);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const res = await fetch(`/api/reports/profit/customers?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setSummary(data.summary);
      } else {
        toast("Failed to load profit data", "error");
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

  // Fetch invoices for drill-down
  const fetchInvoices = useCallback(
    async (customerName: string) => {
      setInvoicesLoading(true);
      try {
        const params = new URLSearchParams({
          customer: customerName,
          from: dateFrom,
          to: dateTo,
        });
        const res = await fetch(`/api/reports/profit/invoices?${params}`);
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices);
        } else {
          toast("Failed to load invoices", "error");
        }
      } catch {
        toast("Network error", "error");
      } finally {
        setInvoicesLoading(false);
      }
    },
    [dateFrom, dateTo, toast]
  );

  function handleRowClick(customerName: string) {
    if (expandedCustomer === customerName) {
      setExpandedCustomer(null);
      return;
    }
    setExpandedCustomer(customerName);
    fetchInvoices(customerName);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Sort customers
  const sorted = [...customers].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  function applyPreset(p: Preset) {
    setDateFrom(p.from);
    setDateTo(p.to);
    setActivePreset(p.label);
  }

  function exportCSV() {
    if (customers.length === 0) return;
    const header = "Customer,Visits,Total Sales,Purchase Cost,Profit,Profit %";
    const rows = customers.map(
      (c) =>
        `"${c.customerName.replace(/"/g, '""')}",${c.invoiceCount},${c.totalSales},${c.totalPurchaseCost},${c.profit},${c.profitPct}%`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer_profit_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const profitMargin =
    summary && summary.totalSales > 0
      ? ((summary.netProfit / summary.totalSales) * 100).toFixed(1)
      : "0.0";

  const kpiCards = [
    {
      label: "Total Sales",
      value: summary ? formatRs(summary.totalSales) : "—",
      icon: ShoppingCart,
      color: "blue",
      sub: `${summary?.customerCount ?? 0} customers`,
    },
    {
      label: "Parts Cost",
      value: summary ? formatRs(summary.totalPurchaseCost) : "—",
      icon: Receipt,
      color: "orange",
      sub: "Cost of goods sold",
    },
    {
      label: "Parts Profit",
      value: summary ? formatRs(summary.partsProfit) : "—",
      icon: Package,
      color: summary && summary.partsProfit >= 0 ? "emerald" : "red",
      sub: "Sales − Cost",
    },
    {
      label: "Labour Profit",
      value: summary ? formatRs(summary.totalLabourIncome) : "—",
      icon: Hammer,
      color: "purple",
      sub: "100% profit",
    },
    {
      label: "Total Expenses",
      value: summary ? formatRs(summary.totalExpenses) : "—",
      icon: TrendingDown,
      color: "red",
      sub: "Business level",
    },
    {
      label: "Net Profit",
      value: summary ? formatRs(summary.netProfit) : "—",
      icon: summary && summary.netProfit >= 0 ? TrendingUp : TrendingDown,
      color: summary && summary.netProfit >= 0 ? "green" : "red",
      sub: `${profitMargin}% margin`,
    },
  ];

  const kpiColorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    orange: "border-orange-200 bg-orange-50",
    red: "border-red-200 bg-red-50",
    green: "border-green-200 bg-green-50",
    emerald: "border-emerald-200 bg-emerald-50",
    purple: "border-purple-200 bg-purple-50",
  };
  const kpiTextMap: Record<string, string> = {
    blue: "text-blue-600",
    orange: "text-orange-600",
    red: "text-red-600",
    green: "text-green-600",
    emerald: "text-emerald-600",
    purple: "text-purple-600",
  };

  const SortHeader = ({
    label,
    field,
    align = "right",
  }: {
    label: string;
    field: SortKey;
    align?: string;
  }) => (
    <th
      className={`text-${align} text-xs font-medium text-gray-500 uppercase px-3 py-3 cursor-pointer select-none hover:text-gray-700 transition-colors`}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${sortKey === field ? "text-red-500" : "text-gray-300"}`}
        />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Profit Report"
        description="Business-optimized profit breakdown — click a customer to drill down"
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
            disabled={customers.length === 0}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ─── KPI Cards (6) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

      {/* ─── Validation check ─── */}
      {summary && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-500 flex justify-between">
          <span>
            Validation: Parts Profit ({formatRs(summary.partsProfit)}) + Labour (
            {formatRs(summary.totalLabourIncome)}) − Expenses (
            {formatRs(summary.totalExpenses)}) ={" "}
            <strong className={summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}>
              {formatRs(summary.netProfit)}
            </strong>
          </span>
          <span className="text-gray-400">
            Net Profit = Σ Customer Profits + Labour − Expenses
          </span>
        </div>
      )}

      {/* ─── Table ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="py-20" />
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="h-12 w-12 mb-3" />
            <p className="font-medium">No sales found</p>
            <p className="text-sm">Try changing the date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                    Customer
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Visits
                  </th>
                  <SortHeader label="Total Sales" field="totalSales" />
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">
                    Purchase Cost
                  </th>
                  <SortHeader label="Profit" field="profit" />
                  <SortHeader label="Profit %" field="profitPct" />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((c) => (
                  <CustomerRow
                    key={c.customerName}
                    customer={c}
                    isExpanded={expandedCustomer === c.customerName}
                    onToggle={() => handleRowClick(c.customerName)}
                    invoices={
                      expandedCustomer === c.customerName ? invoices : []
                    }
                    invoicesLoading={
                      expandedCustomer === c.customerName && invoicesLoading
                    }
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Total ({customers.length} customers)
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-medium text-gray-600">
                    {customers.reduce((s, c) => s + c.invoiceCount, 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                    {summary ? formatRs(summary.totalSales) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-orange-600">
                    {summary ? formatRs(summary.totalPurchaseCost) : "—"}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-sm font-bold ${
                      summary && summary.partsProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {summary ? formatRs(summary.partsProfit) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-500">
                    {summary && summary.totalSales > 0
                      ? ((summary.partsProfit / summary.totalSales) * 100).toFixed(1) + "%"
                      : "—"}
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

/* ─── Customer Row with inline drill-down ─── */

function CustomerRow({
  customer: c,
  isExpanded,
  onToggle,
  invoices,
  invoicesLoading,
}: {
  customer: CustomerProfit;
  isExpanded: boolean;
  onToggle: () => void;
  invoices: Invoice[];
  invoicesLoading: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-gray-50 cursor-pointer transition-colors group"
      >
        <td className="px-4 py-3">
          <span className="text-sm font-medium text-gray-900">{c.customerName}</span>
        </td>
        <td className="px-3 py-3 text-center text-sm text-gray-600">{c.invoiceCount}</td>
        <td className="px-3 py-3 text-right text-sm font-medium text-gray-900">
          {formatRs(c.totalSales)}
        </td>
        <td className="px-3 py-3 text-right text-sm text-orange-600">
          {formatRs(c.totalPurchaseCost)}
        </td>
        <td
          className={`px-3 py-3 text-right text-sm font-bold ${
            c.profit >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatRs(c.profit)}
        </td>
        <td
          className={`px-3 py-3 text-right text-sm font-semibold ${
            c.profitPct >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {c.profitPct.toFixed(1)}%
        </td>
        <td className="pr-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
          )}
        </td>
      </tr>

      {/* ─── Expanded: Invoice Drill-Down ─── */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50/70 px-4 py-4">
            {invoicesLoading ? (
              <LoadingSpinner className="py-8" />
            ) : invoices.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No invoices found</p>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  {invoices.length} Invoice{invoices.length !== 1 ? "s" : ""} for{" "}
                  {c.customerName}
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">
                          Invoice
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">
                          Date
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">
                          Sale
                        </th>
                        <th className="text-right text-xs font-medium text-orange-500 px-3 py-2">
                          Cost
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">
                          Profit
                        </th>
                        <th className="text-center text-xs font-medium text-gray-500 px-3 py-2">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/60">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            INV-{inv.id}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {formatDateTime(inv.date)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {formatRs(inv.saleAmount)}
                          </td>
                          <td className="px-3 py-2 text-right text-orange-600">
                            {formatRs(inv.purchaseCost)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-bold ${
                              inv.profit >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {formatRs(inv.profit)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <StatusBadge status={inv.status} />
                              <PayBadge type={inv.paymentType} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100/50 border-t border-gray-200">
                        <td
                          colSpan={2}
                          className="px-3 py-2 text-xs font-semibold text-gray-500"
                        >
                          Total ({invoices.length})
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                          {formatRs(invoices.reduce((s, i) => s + i.saleAmount, 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-orange-600">
                          {formatRs(invoices.reduce((s, i) => s + i.purchaseCost, 0))}
                        </td>
                        <td
                          className={`px-3 py-2 text-right text-sm font-bold ${
                            invoices.reduce((s, i) => s + i.profit, 0) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatRs(invoices.reduce((s, i) => s + i.profit, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function CustomerProfitPage() {
  return (
    <Suspense>
      <CustomerProfitPageContent />
    </Suspense>
  );
}
