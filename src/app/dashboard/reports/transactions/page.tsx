"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Search,
  Download,
  ArrowRightLeft,
  ShoppingCart,
  Wrench,
  Truck,
  TrendingUp,
  TrendingDown,
  Filter,
  User,
  CreditCard,
  Phone,
  Bike,
  FileText,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { formatRs, formatDateTime as formatDate, PayBadge, StatusBadge, ItemsTable, InvoiceTotals, InfoRow, LoadingSpinner } from "@/components/DrillDown";
import { today, monthStart, getDatePresets, parseDateParams } from "@/lib/report-filters";

/* ─── Types ───────────────────────────────────── */

interface Transaction {
  id: number;
  type: "sale" | "service" | "purchase";
  date: string;
  customer: string;
  description: string;
  paymentType: string;
  itemCount: number;
  total: number;
  status: string;
  ref: string;
}

interface Summary {
  salesTotal: number;
  servicesTotal: number;
  purchasesTotal: number;
  netCashFlow: number;
  count: number;
}

interface InvoiceItem {
  name: string;
  partNumber: string;
  qty: number;
  price: number;
  total: number;
}

interface InvoiceDetail {
  type: "sale" | "service" | "purchase";
  id: number;
  ref: string;
  date: string;
  customer: string;
  bike?: string | null;
  phone?: string | null;
  serviceType?: string;
  paymentType: string;
  status: string;
  subtotal?: number;
  laborCost?: number;
  discount?: number;
  total: number;
  note?: string | null;
  items: InvoiceItem[];
  labourItems: { name: string; qty: number; price: number; total: number }[];
}

/* ─── Helpers ────────────────────────────────── */

const typeBadge: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  sale: { label: "Sale", cls: "bg-green-100 text-green-700", icon: ShoppingCart },
  service: { label: "Service", cls: "bg-blue-100 text-blue-700", icon: Wrench },
  purchase: { label: "Purchase", cls: "bg-orange-100 text-orange-700", icon: Truck },
};

type Preset = { label: string; from: string; to: string };

// Keep local getPresets for backward compat — delegates to centralized
const getPresets = getDatePresets;

/* ─── Component ──────────────────────────────── */

export default function TransactionsReportPage() {
  const sp = useSearchParams();
  const urlDates = parseDateParams(sp, monthStart(), today());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(urlDates.from);
  const [dateTo, setDateTo] = useState(urlDates.to);
  const [typeFilter, setTypeFilter] = useState(sp.get("type") || "all");
  const [paymentFilter, setPaymentFilter] = useState(sp.get("paymentType") || "all");
  const [search, setSearch] = useState("");
  const [activePreset, setActivePreset] = useState(urlDates.fromUrl ? "" : "This Month");

  // Invoice detail
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const presets = getPresets();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
        type: typeFilter,
        paymentType: paymentFilter,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/reports/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, typeFilter, paymentFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  function applyPreset(p: Preset) {
    setDateFrom(p.from);
    setDateTo(p.to);
    setActivePreset(p.label);
  }

  async function openInvoice(t: Transaction) {
    setInvoiceDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/reports/transactions/detail?type=${t.type}&id=${t.id}`);
      if (res.ok) setInvoiceDetail(await res.json());
    } catch (err) {
      console.error("Failed to fetch invoice:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  function exportCSV() {
    if (transactions.length === 0) return;
    const headers = ["Date", "Type", "Ref", "Customer", "Description", "Payment", "Items", "Total", "Status"];
    const rows = transactions.map((t) => [
      new Date(t.date).toISOString().split("T")[0],
      t.type,
      t.ref,
      `"${t.customer}"`,
      `"${t.description}"`,
      t.paymentType,
      t.itemCount,
      t.total,
      t.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = summary
    ? [
        { label: "Sales", value: formatRs(summary.salesTotal), icon: ShoppingCart, color: "text-green-600", bg: "bg-green-50", filter: "sale" },
        { label: "Services", value: formatRs(summary.servicesTotal), icon: Wrench, color: "text-blue-600", bg: "bg-blue-50", filter: "service" },
        { label: "Purchases", value: formatRs(summary.purchasesTotal), icon: Truck, color: "text-orange-600", bg: "bg-orange-50", filter: "purchase" },
        {
          label: "Net Cash Flow",
          value: formatRs(summary.netCashFlow),
          icon: summary.netCashFlow >= 0 ? TrendingUp : TrendingDown,
          color: summary.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600",
          bg: summary.netCashFlow >= 0 ? "bg-emerald-50" : "bg-red-50",
          filter: "all",
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Transactions Report"
        description="All sales, services & purchases in one place"
        action={
          transactions.length > 0 ? (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activePreset === p.label ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, job card..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="service">Services</option>
              <option value="purchase">Purchases</option>
            </select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="all">All Payments</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && transactions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              onClick={() => setTypeFilter(k.filter === typeFilter ? "all" : k.filter)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                typeFilter === k.filter && k.filter !== "all" ? "border-red-400 ring-1 ring-red-200" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <span className="text-xs font-medium text-gray-500">{k.label}</span>
              </div>
              <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No transactions found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Ref</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer / Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Description</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Payment</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Items</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const badge = typeBadge[t.type];
                  const Icon = badge.icon;
                  return (
                    <tr key={`${t.type}-${t.id}`} onClick={() => openInvoice(t)} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.cls}`}>
                          <Icon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">{t.ref}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[160px] truncate">{t.customer}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{t.description}</td>
                      <td className="px-4 py-3 text-center">
                        <PayBadge type={t.paymentType} />
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">{t.itemCount}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap ${
                        t.total < 0 ? "text-red-600" : "text-green-700"
                      }`}>
                        {formatRs(t.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={t.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {summary && transactions.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{summary.count}</span> transactions
          </div>
        )}
      </div>

      {/* ── Invoice Detail Modal ── */}
      <Modal
        open={detailLoading || !!invoiceDetail}
        onClose={() => { setInvoiceDetail(null); setDetailLoading(false); }}
        title={invoiceDetail ? `${typeBadge[invoiceDetail.type]?.label || "Transaction"} — ${invoiceDetail.ref}` : "Loading..."}
        wide
      >
        {detailLoading ? (
          <LoadingSpinner />
        ) : invoiceDetail ? (
          <div className="space-y-5">
            {/* ── Header info ── */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <InfoRow icon={User} label="Customer">
                  <span className="font-medium text-gray-900">{invoiceDetail.customer}</span>
                </InfoRow>
                <InfoRow icon={Calendar} label="Date">
                  <span className="font-medium text-gray-900">{formatDate(invoiceDetail.date)}</span>
                </InfoRow>
                <InfoRow icon={CreditCard} label="Payment">
                  <PayBadge type={invoiceDetail.paymentType} />
                </InfoRow>
                <InfoRow icon={FileText} label="Status">
                  <StatusBadge status={invoiceDetail.status} />
                </InfoRow>
              </div>
              {invoiceDetail.bike && (
                <InfoRow icon={Bike} label="Bike">
                  <span className="font-medium text-gray-900">{invoiceDetail.bike}</span>
                </InfoRow>
              )}
              {invoiceDetail.phone && (
                <InfoRow icon={Phone} label="Phone">
                  <span className="font-medium text-gray-900">{invoiceDetail.phone}</span>
                </InfoRow>
              )}
              {invoiceDetail.serviceType && (
                <InfoRow icon={Wrench} label="Service Type">
                  <span className="font-medium text-gray-900">{invoiceDetail.serviceType}</span>
                </InfoRow>
              )}
              {invoiceDetail.note && (
                <div className="text-xs text-gray-500 border-t border-gray-200 pt-2 mt-2">
                  Note: {invoiceDetail.note}
                </div>
              )}
            </div>

            {/* ── Items table ── */}
            <ItemsTable items={invoiceDetail.items} label="Parts / Items" />

            {/* ── Labour items ── */}
            <ItemsTable items={invoiceDetail.labourItems} label="Labour" color="purple" />

            {invoiceDetail.items.length === 0 && invoiceDetail.labourItems.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-6 bg-gray-50 rounded-lg">No line items</p>
            )}

            {/* ── Invoice totals ── */}
            <InvoiceTotals
              subtotal={invoiceDetail.subtotal}
              laborCost={invoiceDetail.laborCost}
              discount={invoiceDetail.discount}
              total={invoiceDetail.total}
              totalColor={invoiceDetail.type === "purchase" ? "text-orange-700" : "text-green-700"}
            />
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8">Failed to load invoice detail</p>
        )}
      </Modal>
    </>
  );
}
