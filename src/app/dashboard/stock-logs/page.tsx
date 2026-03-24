"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ArrowUpCircle, ArrowDownCircle, Settings } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { fmtRs } from "@/lib/utils";

interface StockLog {
  id: number;
  type: string;
  quantity: number;
  prevStock: number;
  newStock: number;
  purchasePrice: number | null;
  prevPrice: number | null;
  note: string | null;
  createdAt: string;
  part: { id: number; name: string; partNumber: string };
}

type FilterType = "all" | "in" | "out" | "adjustment";

// Map DB types to display direction
function getDirection(type: string): "in" | "out" | "adjustment" {
  if (type === "purchase") return "in";
  if (type === "sale" || type === "service") return "out";
  return "adjustment";
}

export default function StockLogsPage() {
  const [allLogs, setAllLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  const fetchLogs = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock-logs?limit=200", { signal });
      if (res.ok) setAllLogs(await res.json());
    } catch (err) { if (err instanceof Error && err.name === "AbortError") return; console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const c = new AbortController(); fetchLogs(c.signal); return () => c.abort(); }, [fetchLogs]);

  const logs = filter === "all" ? allLogs : allLogs.filter((l) => getDirection(l.type) === filter);


  const typeIcon = (type: string) => {
    const dir = getDirection(type);
    if (dir === "in") return <ArrowUpCircle className="w-4 h-4 text-green-500" />;
    if (dir === "out") return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
    return <Settings className="w-4 h-4 text-blue-500" />;
  };
  const typeBadge = (type: string) => {
    const dir = getDirection(type);
    const colors: Record<string, string> = {
      in: "bg-green-100 text-green-700",
      out: "bg-red-100 text-red-700",
      adjustment: "bg-blue-100 text-blue-700",
    };
    return colors[dir] || "bg-gray-100 text-gray-700";
  };
  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      purchase: "Purchase",
      sale: "Sale",
      service: "Service",
      adjustment: "Adjustment",
    };
    return labels[type] || type;
  };

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "in", label: "Stock In" },
    { value: "out", label: "Stock Out" },
    { value: "adjustment", label: "Adjustments" },
  ];

  return (
    <>
      <PageHeader title="Stock Logs" description="Track all stock movements" />

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-red-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Part</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Type</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Qty</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Stock Change</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Price</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                  No stock logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{log.part.name}</div>
                    <div className="text-xs text-gray-400">{log.part.partNumber}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${typeBadge(log.type)}`}>
                      {typeIcon(log.type)}
                      {typeLabel(log.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold">
                    <span className={getDirection(log.type) === "in" ? "text-green-600" : getDirection(log.type) === "out" ? "text-red-600" : "text-blue-600"}>
                      {log.quantity > 0 ? "+" : ""}{log.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.prevStock} → {log.newStock}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.purchasePrice != null ? fmtRs(log.purchasePrice) : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 max-w-[200px] truncate">
                    {log.note || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && logs.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            Showing {logs.length} log(s)
          </div>
        )}
      </div>
    </>
  );
}
