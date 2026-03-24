"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  Search,
  Download,
  UserSearch,
  Users,
  ArrowLeft,
  ChevronRight,
  ShoppingCart,
  Phone,
  Bike,
  Calendar,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { formatRs, formatDate, StatusBadge, LoadingSpinner } from "@/components/DrillDown";
import { today, monthStart, getDatePresets, parseDateParams } from "@/lib/report-filters";

/* ─── Types ───────────────────────────────── */

interface Customer {
  name: string;
  phone: string | null;
  salesCount: number;
  salesTotal: number;
  servicesCount: number;
  servicesTotal: number;
  totalSpent: number;
  totalVisits: number;
  bikes: string[];
  vehicles: string[];
  lastVisit: string;
  creditCount: number;
}

interface CustSummary {
  totalCustomers: number;
  totalRevenue: number;
  avgSpend: number;
}

interface TimelineEntry {
  id: number;
  type: "sale" | "service" | "jobcard";
  date: string;
  description: string;
  total: number;
  status: string;
  items: { name: string; qty: number; price: number; total: number }[];
  ref: string;
  bike: string;
  vehicle: string;
}

interface CustomerDetail {
  customer: {
    name: string;
    phone: string | null;
    bikes: string[];
    totalSpent: number;
    salesCount: number;
    servicesCount: number;
    totalVisits: number;
  };
  timeline: TimelineEntry[];
}

/* ─── Helpers ──────────────────────────────── */

const customerTypeBadge: Record<string, { label: string; cls: string }> = {
  sale: { label: "Sale", cls: "bg-green-100 text-green-700" },
  service: { label: "Service", cls: "bg-blue-100 text-blue-700" },
  jobcard: { label: "Job Card", cls: "bg-purple-100 text-purple-700" },
};

/* ─── Component ────────────────────────────── */

export default function CustomersReportPage() {
  return <Suspense fallback={<LoadingSpinner className="py-20" />}><CustomersReportContent /></Suspense>;
}

function CustomersReportContent() {
  const sp = useSearchParams();
  const urlDates = parseDateParams(sp, monthStart(), today());

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<CustSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(urlDates.from);
  const [dateTo, setDateTo] = useState(urlDates.to);
  const [activePreset, setActivePreset] = useState(urlDates.fromUrl ? "" : "This Month");
  const presets = getDatePresets();

  // Detail
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const fetchCustomers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/reports/customers?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setSummary(data.summary);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(() => fetchCustomers(c.signal), 300);
    return () => { clearTimeout(t); c.abort(); };
  }, [fetchCustomers]);

  async function openDetail(customer: Customer) {
    setDetailLoading(true);
    setDetail(null);
    setExpandedEntry(null);
    try {
      const params = new URLSearchParams({ name: customer.name });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/reports/customers?${params}`);
      if (res.ok) {
        setDetail(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  function exportCSV() {
    if (customers.length === 0) return;
    const headers = ["Name", "Phone", "Bikes", "Vehicle #", "Sales", "Sales Total", "Services", "Services Total", "Total Spent", "Visits", "Last Visit"];
    const rows = customers.map((c) => [
      `"${c.name}"`, c.phone || "", `"${c.bikes.join(", ")}"`, `"${c.vehicles.join(", ")}"`, c.salesCount, c.salesTotal, c.servicesCount, c.servicesTotal, c.totalSpent, c.totalVisits, c.lastVisit.split("T")[0],
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Detail View ── */
  if (detail || detailLoading) {
    return (
      <>
        <PageHeader
          title={detail ? `${detail.customer.name}` : "Loading..."}
          description="Full customer history"
          action={
            <button
              onClick={() => { setDetail(null); setDetailLoading(false); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to List
            </button>
          }
        />

        {detailLoading ? (
          <LoadingSpinner className="py-20" />
        ) : detail ? (
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-wrap items-center gap-6">
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                  <UserSearch className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">{detail.customer.name}</h2>
                  {detail.customer.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                      <Phone className="w-3.5 h-3.5" />
                      {detail.customer.phone}
                    </div>
                  )}
                  {detail.customer.bikes.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                      <Bike className="w-3.5 h-3.5" />
                      {detail.customer.bikes.join(", ")}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-red-600">{formatRs(detail.customer.totalSpent)}</div>
                    <div className="text-xs text-gray-500">Total Spent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{detail.customer.totalVisits}</div>
                    <div className="text-xs text-gray-500">Visits</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{detail.customer.salesCount + detail.customer.servicesCount}</div>
                    <div className="text-xs text-gray-500">Transactions</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Transaction History</h3>
              </div>
              {detail.timeline.length === 0 ? (
                <p className="text-gray-400 text-center py-10">No transactions found</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {detail.timeline.map((t) => {
                    const badge = customerTypeBadge[t.type] || customerTypeBadge.sale;
                    const expanded = expandedEntry === t.id && t.type === expandedEntry.toString() ? false : expandedEntry === t.id;
                    return (
                      <div key={`${t.type}-${t.id}`}>
                        <button
                          className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedEntry(expanded ? null : t.id)}
                        >
                          <div className="w-10 text-center">
                            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{t.description}</div>
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                              <span>{formatDate(t.date)}</span>
                              {t.bike && <span>{t.bike}</span>}
                              {t.vehicle && <span>#{t.vehicle}</span>}
                            </div>
                          </div>
                          <div className={`text-sm font-bold ${t.total > 0 ? "text-gray-900" : "text-gray-400"}`}>
                            {t.total > 0 ? formatRs(t.total) : "—"}
                          </div>
                          <StatusBadge status={t.status} />
                          {t.items.length > 0 && (
                            <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? "rotate-90" : ""}`} />
                          )}
                        </button>

                        {/* Expanded items */}
                        {expanded && t.items.length > 0 && (
                          <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1 font-medium">Item</th>
                                  <th className="text-right py-1 font-medium">Qty</th>
                                  <th className="text-right py-1 font-medium">Price</th>
                                  <th className="text-right py-1 font-medium">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.items.map((item, idx) => (
                                  <tr key={idx} className="border-t border-gray-100">
                                    <td className="py-1 text-gray-700">{item.name}</td>
                                    <td className="py-1 text-right text-gray-500">{item.qty}</td>
                                    <td className="py-1 text-right text-gray-500">{formatRs(item.price)}</td>
                                    <td className="py-1 text-right font-medium text-gray-900">{formatRs(item.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  /* ── List View ── */
  return (
    <>
      <PageHeader
        title="Customer Report"
        description="Customer spending history & drill-down"
        action={
          customers.length > 0 ? (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Download className="w-4 h-4" /> CSV
            </button>
          ) : undefined
        }
      />

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Period:</span>
          </div>
          {presets.map((p) => (
            <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); setActivePreset(p.label); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activePreset === p.label ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >{p.label}</button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or bike model..."
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Customers</span>
            </div>
            <div className="text-lg font-bold text-blue-600">{summary.totalCustomers}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Revenue</span>
            </div>
            <div className="text-lg font-bold text-green-600">{formatRs(summary.totalRevenue)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <UserSearch className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Avg Spend</span>
            </div>
            <div className="text-lg font-bold text-purple-600">{formatRs(summary.avgSpend)}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="py-20" />
        ) : customers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <UserSearch className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Bikes</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Vehicle #</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Sales</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Services</th>
                  <th className="text-right px-4 py-3 font-semibold text-green-700 text-xs uppercase tracking-wide bg-green-50/50">Total Spent</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Visits</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Last Visit</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.name}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openDetail(c)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.creditCount > 0 && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                          {c.creditCount} credit
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">{c.bikes.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">{c.vehicles.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {c.salesCount > 0 ? `${c.salesCount} (${formatRs(c.salesTotal)})` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {c.servicesCount > 0 ? `${c.servicesCount} (${formatRs(c.servicesTotal)})` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-700 bg-green-50/30">
                      {formatRs(c.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{c.totalVisits}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(c.lastVisit)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
