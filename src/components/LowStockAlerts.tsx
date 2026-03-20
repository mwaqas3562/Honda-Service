"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  Settings2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  PackageX,
  Package,
  Search,
} from "lucide-react";

export interface StockAlert {
  id: number;
  name: string;
  partNumber: string;
  category: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  salePrice: number;
  avgDailySales: number;
  estimatedDaysLeft: number | null;
  severity: "red" | "orange" | "green" | "safe";
  suggestedReorderQty: number;
  lastVendor: string | null;
  lastPurchasePrice: number | null;
}

interface StockAlertsResponse {
  alerts: StockAlert[];
  totalParts: number;
  lookbackDays: number;
  threshold: number;
}

interface LowStockAlertsProps {
  /** "inventory" = full table view; "dashboard" = compact banner view */
  variant?: "inventory" | "dashboard";
  onReorderClick?: (alert: StockAlert) => void;
}

const SEVERITY_CONFIG = {
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    label: "Critical",
    icon: PackageX,
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
    label: "Warning",
    icon: AlertTriangle,
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
    label: "OK",
    icon: Package,
  },
  safe: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
    label: "Safe",
    icon: Package,
  },
};

export default function LowStockAlerts({ variant = "inventory", onReorderClick }: LowStockAlertsProps) {
  const [data, setData] = useState<StockAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookbackDays, setLookbackDays] = useState(14);
  const [threshold, setThreshold] = useState(7);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "red" | "orange" | "green" | "safe">("all");

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/parts/stock-alerts?days=${lookbackDays}&threshold=${threshold}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch stock alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [lookbackDays, threshold]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const exportCSV = () => {
    if (!data?.alerts.length) return;
    const headers = [
      "Part Name",
      "Part Number",
      "Category",
      "Current Stock",
      "Min Stock",
      "Avg Daily Sales",
      "Est. Days Left",
      "Severity",
      "Suggested Reorder Qty",
      "Purchase Price",
      "Last Vendor",
      "Est. Reorder Cost",
    ];
    const rows = data.alerts.map((a) => [
      a.name,
      a.partNumber,
      a.category,
      a.stock,
      a.minStock,
      a.avgDailySales,
      a.estimatedDaysLeft ?? "N/A",
      a.severity === "red" ? "Critical (<3 days)" : a.severity === "orange" ? "Warning (3-7 days)" : "OK (>7 days)",
      a.suggestedReorderQty,
      a.purchasePrice,
      a.lastVendor ?? "N/A",
      Math.round(a.suggestedReorderQty * (a.lastPurchasePrice ?? a.purchasePrice)),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-alerts-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDays = (days: number | null) => {
    if (days === null) return "No recent sales";
    if (days === 0) return "Out of stock";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  };

  const redCount = data?.alerts.filter((a) => a.severity === "red").length ?? 0;
  const orangeCount = data?.alerts.filter((a) => a.severity === "orange").length ?? 0;
  const greenCount = data?.alerts.filter((a) => a.severity === "green").length ?? 0;
  const safeCount = data?.alerts.filter((a) => a.severity === "safe").length ?? 0;

  const filteredAlerts = useMemo(() => {
    if (!data?.alerts) return [];
    let items = data.alerts;
    if (severityFilter !== "all") {
      items = items.filter((a) => a.severity === severityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.partNumber.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [data?.alerts, severityFilter, search]);

  if (loading) {
    return (
      <div className={`${variant === "dashboard" ? "mb-8" : "mb-6"} bg-gray-50 border border-gray-200 rounded-xl p-4`}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400">Loading stock alerts...</span>
        </div>
      </div>
    );
  }

  if (!data?.alerts.length && variant === "dashboard") {
    return null;
  }

  if (!data) {
    return null;
  }

  // ═══════ DASHBOARD VARIANT — compact banner ═══════
  if (variant === "dashboard") {
    const criticalAlerts = data.alerts.filter((a) => a.severity !== "safe");
    const displayAlerts = expanded ? criticalAlerts : criticalAlerts.slice(0, 8);
    return (
      <div className="mb-8">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Smart Stock Alerts</h2>
                <p className="text-xs text-gray-400">Based on last {data.lookbackDays} days of sales</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {redCount > 0 && (
                <span className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                  {redCount} critical
                </span>
              )}
              {orangeCount > 0 && (
                <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
                  {orangeCount} warning
                </span>
              )}
              {greenCount > 0 && (
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                  {greenCount} ok
                </span>
              )}
            </div>
          </div>

          {/* Alerts list */}
          <div className="divide-y divide-gray-50">
            {displayAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              return (
                <div key={alert.id} className={`px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors`}>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{alert.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                        {formatDays(alert.estimatedDaysLeft)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Stock: {alert.stock} · Avg: {alert.avgDailySales}/day
                      {alert.suggestedReorderQty > 0 && ` · Reorder: ${alert.suggestedReorderQty}`}
                    </div>
                  </div>
                  {onReorderClick && alert.suggestedReorderQty > 0 && (
                    <button
                      onClick={() => onReorderClick(alert)}
                      className="flex-shrink-0 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      Reorder
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Show more / less */}
          {criticalAlerts.length > 8 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-5 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1 transition-colors"
            >
              {expanded ? (
                <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>Show All {criticalAlerts.length} Alerts <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════ INVENTORY VARIANT — full page with search, filters, table ═══════
  const totalAlerts = data?.alerts.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setSeverityFilter(severityFilter === "red" ? "all" : "red")}
          className={`rounded-xl border p-4 text-left transition-all ${
            severityFilter === "red" ? "border-red-400 bg-red-50 ring-2 ring-red-200" : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <PackageX className="w-4.5 h-4.5 text-red-500" />
            <span className="text-2xl font-extrabold text-red-600">{redCount}</span>
          </div>
          <p className="text-xs font-semibold text-red-700">Critical</p>
          <p className="text-[10px] text-red-400">&lt;3 days left</p>
        </button>
        <button
          onClick={() => setSeverityFilter(severityFilter === "orange" ? "all" : "orange")}
          className={`rounded-xl border p-4 text-left transition-all ${
            severityFilter === "orange" ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200" : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <AlertTriangle className="w-4.5 h-4.5 text-orange-500" />
            <span className="text-2xl font-extrabold text-orange-600">{orangeCount}</span>
          </div>
          <p className="text-xs font-semibold text-orange-700">Warning</p>
          <p className="text-[10px] text-orange-400">3–{data?.threshold ?? 7} days left</p>
        </button>
        <button
          onClick={() => setSeverityFilter(severityFilter === "green" ? "all" : "green")}
          className={`rounded-xl border p-4 text-left transition-all ${
            severityFilter === "green" ? "border-green-400 bg-green-50 ring-2 ring-green-200" : "border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <Package className="w-4.5 h-4.5 text-green-500" />
            <span className="text-2xl font-extrabold text-green-600">{greenCount}</span>
          </div>
          <p className="text-xs font-semibold text-green-700">OK</p>
          <p className="text-[10px] text-green-400">&gt;{data?.threshold ?? 7} days left</p>
        </button>
        <button
          onClick={() => setSeverityFilter(severityFilter === "safe" ? "all" : "safe")}
          className={`rounded-xl border p-4 text-left transition-all ${
            severityFilter === "safe" ? "border-gray-400 bg-gray-50 ring-2 ring-gray-300" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <Package className="w-4.5 h-4.5 text-gray-400" />
            <span className="text-2xl font-extrabold text-gray-600">{safeCount}</span>
          </div>
          <p className="text-xs font-semibold text-gray-700">Safe</p>
          <p className="text-[10px] text-gray-400">No recent usage</p>
        </button>
      </div>

      {/* Search + Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, part number, or category..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg border transition-colors ${
              showSettings
                ? "bg-red-50 text-red-700 border-red-300 hover:bg-red-100"
                : "text-gray-600 hover:text-gray-800 bg-white border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Lookback Period:</label>
            <select
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value))}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Alert if runs out within:</label>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;3 days</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> 3–{threshold} days</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> &gt;{threshold} days</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> No usage</span>
          </div>
        </div>
      )}

      {/* Results info */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Showing <strong>{filteredAlerts.length}</strong> of {totalAlerts} parts
          {severityFilter !== "all" && (
            <> · Filter: <span className="font-semibold capitalize">{severityFilter}</span>
              <button onClick={() => setSeverityFilter("all")} className="ml-1 text-red-600 hover:text-red-700">✕</button>
            </>
          )}
          {search && (
            <> · Search: &ldquo;{search}&rdquo;
              <button onClick={() => setSearch("")} className="ml-1 text-red-600 hover:text-red-700">✕</button>
            </>
          )}
        </p>
        <p className="text-xs text-gray-400">
          Based on last {data?.lookbackDays ?? 14} days
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Part</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs">Stock</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs">Avg/Day</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs">Days Left</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs">Reorder Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No parts match your search</p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const cfg = SEVERITY_CONFIG[alert.severity];
                  const estCost = Math.round(alert.suggestedReorderQty * (alert.lastPurchasePrice ?? alert.purchasePrice));
                  return (
                    <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{alert.name}</div>
                        <div className="text-xs text-gray-400">{alert.partNumber} · {alert.category}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          alert.stock === 0
                            ? "bg-red-100 text-red-700"
                            : alert.stock <= alert.minStock
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {alert.stock}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600 text-xs font-medium">
                        {alert.avgDailySales}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className={`w-3 h-3 ${
                            alert.severity === "red" ? "text-red-500" : alert.severity === "orange" ? "text-orange-500" : alert.severity === "green" ? "text-green-500" : "text-gray-400"
                          }`} />
                          <span className={`text-xs font-bold ${
                            alert.severity === "red" ? "text-red-700" : alert.severity === "orange" ? "text-orange-700" : alert.severity === "green" ? "text-green-700" : "text-gray-500"
                          }`}>
                            {formatDays(alert.estimatedDaysLeft)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-blue-700 text-xs">
                        {alert.suggestedReorderQty > 0 ? alert.suggestedReorderQty : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-600">
                        {estCost > 0 ? `Rs ${estCost.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredAlerts.length > 0 && filteredAlerts.some((a) => a.suggestedReorderQty > 0) && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                    Total Estimated Reorder Cost ({filteredAlerts.filter((a) => a.suggestedReorderQty > 0).length} items)
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">
                    Rs {Math.round(
                      filteredAlerts.reduce((sum, a) => sum + a.suggestedReorderQty * (a.lastPurchasePrice ?? a.purchasePrice), 0)
                    ).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
