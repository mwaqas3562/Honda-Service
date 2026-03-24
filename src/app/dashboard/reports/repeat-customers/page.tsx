"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Users,
  Repeat,
  CalendarClock,
  TrendingUp,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { formatRs, formatDate } from "@/components/DrillDown";

/* ─── Types ───────────────────────────────── */

interface RepeatCustomer {
  bikeNumber: string;
  customerName: string;
  phone: string | null;
  totalVisits: number;
  lastVisitDate: string;
  avgGapDays: number;
  repeatType: "frequent" | "monthly" | "occasional";
  totalSpent: number;
}

interface Summary {
  total: number;
  frequent: number;
  monthly: number;
  occasional: number;
  totalRevenue: number;
}

interface Visit {
  id: number;
  type: string;
  ref: string;
  date: string;
  customer: string;
  amount: number;
  paymentType: string;
  gapDays: number | null;
}

/* ─── Helpers ──────────────────────────────── */

const repeatBadge: Record<string, { label: string; cls: string }> = {
  frequent: { label: "Frequent", cls: "bg-green-100 text-green-700" },
  monthly: { label: "Monthly", cls: "bg-blue-100 text-blue-700" },
  occasional: { label: "Occasional", cls: "bg-amber-100 text-amber-700" },
};

const typeBadge: Record<string, { label: string; cls: string }> = {
  sale: { label: "Sale", cls: "bg-green-100 text-green-700" },
  service: { label: "Service", cls: "bg-blue-100 text-blue-700" },
  jobcard: { label: "Job Card", cls: "bg-purple-100 text-purple-700" },
};

/* ─── Component ────────────────────────────── */

export default function RepeatCustomersPage() {
  const [customers, setCustomers] = useState<RepeatCustomer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minVisits, setMinVisits] = useState("2");
  const [repeatFilter, setRepeatFilter] = useState("");

  // Drill-down
  const [drillBike, setDrillBike] = useState<RepeatCustomer | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (minVisits) params.set("minVisits", minVisits);
        if (repeatFilter) params.set("repeatType", repeatFilter);
        const res = await fetch(`/api/reports/repeat-customers?${params}`, { signal });
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
    },
    [dateFrom, dateTo, minVisits, repeatFilter]
  );

  useEffect(() => {
    const c = new AbortController();
    fetchData(c.signal);
    return () => c.abort();
  }, [fetchData]);

  async function openDrill(customer: RepeatCustomer) {
    setDrillBike(customer);
    setDrillLoading(true);
    setVisits([]);
    try {
      const params = new URLSearchParams({ bike: customer.bikeNumber });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/reports/repeat-customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVisits(data.visits);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDrillLoading(false);
    }
  }

  // Client-side search filter
  const filtered = search
    ? customers.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.bikeNumber.toLowerCase().includes(q) ||
          c.customerName.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
        );
      })
    : customers;

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = [
      "Bike Number",
      "Customer",
      "Phone",
      "Total Visits",
      "Avg Gap (Days)",
      "Repeat Type",
      "Total Spent",
      "Last Visit",
    ];
    const rows = filtered.map((c) => [
      `"${c.bikeNumber}"`,
      `"${c.customerName}"`,
      c.phone || "",
      c.totalVisits,
      c.avgGapDays,
      c.repeatType,
      c.totalSpent,
      c.lastVisitDate.split("T")[0],
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repeat-customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Drill-down View ── */
  if (drillBike) {
    return (
      <>
        <PageHeader
          title={`${drillBike.bikeNumber}`}
          description={`${drillBike.customerName} — Visit history & gap analysis`}
          action={
            <button
              onClick={() => { setDrillBike(null); setVisits([]); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </button>
          }
        />

        {/* Customer summary card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
              <Repeat className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900">{drillBike.customerName}</h2>
              <div className="text-sm text-gray-500 mt-0.5">
                {drillBike.bikeNumber}
                {drillBike.phone && ` · ${drillBike.phone}`}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{drillBike.totalVisits}</div>
                <div className="text-xs text-gray-500">Visits</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{drillBike.avgGapDays}d</div>
                <div className="text-xs text-gray-500">Avg Gap</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{formatRs(drillBike.totalSpent)}</div>
                <div className="text-xs text-gray-500">Total Spent</div>
              </div>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${repeatBadge[drillBike.repeatType]?.cls}`}>
              {repeatBadge[drillBike.repeatType]?.label}
            </span>
          </div>
        </div>

        {/* Visits timeline */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Visit Timeline</h3>
          </div>
          {drillLoading ? (
            <div className="py-20 flex justify-center">
              <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          ) : visits.length === 0 ? (
            <p className="text-gray-400 text-center py-10">No visits found</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visits.map((v, idx) => {
                const badge = typeBadge[v.type] || typeBadge.sale;
                return (
                  <div key={`${v.type}-${v.id}-${idx}`} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 text-center text-xs font-bold text-gray-400">
                      #{idx + 1}
                    </div>
                    <div className="w-16 text-center">
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{v.ref}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDate(v.date)} · {v.customer}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900 w-24 text-right">
                      {v.amount > 0 ? formatRs(v.amount) : "—"}
                    </div>
                    <div className="w-24 text-right">
                      {v.gapDays !== null ? (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            v.gapDays <= 30
                              ? "bg-green-100 text-green-700"
                              : v.gapDays <= 60
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          +{v.gapDays}d gap
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">First visit</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── List View ── */
  return (
    <>
      <PageHeader
        title="Customer Repeat Analysis"
        description="Track returning customers and visit patterns by bike number"
        action={
          filtered.length > 0 ? (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by bike number, customer, or phone..."
              className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            title="To date"
          />
          <select
            value={minVisits}
            onChange={(e) => setMinVisits(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
          >
            <option value="2">Min 2 visits</option>
            <option value="3">Min 3 visits</option>
            <option value="5">Min 5 visits</option>
            <option value="10">Min 10 visits</option>
          </select>
          <select
            value={repeatFilter}
            onChange={(e) => setRepeatFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="frequent">Frequent (≤30d)</option>
            <option value="monthly">Monthly (30–60d)</option>
            <option value="occasional">Occasional (&gt;60d)</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-gray-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Repeat className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Frequent</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{summary.frequent}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Monthly</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{summary.monthly}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Occasional</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">{summary.occasional}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Revenue</span>
            </div>
            <div className="text-lg font-bold text-emerald-600">{formatRs(summary.totalRevenue)}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Repeat className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No repeat customers found</p>
            <p className="text-xs mt-1">Try adjusting filters or date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Bike #
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Visits
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Avg Gap
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-green-700 text-xs uppercase tracking-wide bg-green-50/50">
                    Total Spent
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Last Visit
                  </th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const badge = repeatBadge[c.repeatType];
                  return (
                    <tr
                      key={c.bikeNumber}
                      className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer ${
                        c.repeatType === "frequent"
                          ? "bg-green-50/20"
                          : c.repeatType === "occasional"
                          ? "bg-amber-50/20"
                          : ""
                      }`}
                      onClick={() => openDrill(c)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-gray-900">{c.bikeNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.customerName}</div>
                        {c.phone && (
                          <div className="text-xs text-gray-400 mt-0.5">{c.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold text-gray-900">
                          {c.totalVisits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-semibold ${
                            c.avgGapDays <= 30
                              ? "text-green-600"
                              : c.avgGapDays <= 60
                              ? "text-blue-600"
                              : "text-amber-600"
                          }`}
                        >
                          {c.avgGapDays}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge?.cls}`}
                        >
                          {badge?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50/30">
                        {formatRs(c.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(c.lastVisitDate)}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between text-sm text-gray-500">
            <span>{filtered.length} customer(s)</span>
            <span className="font-semibold text-gray-700">
              Total: {formatRs(filtered.reduce((s, c) => s + c.totalSpent, 0))}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
