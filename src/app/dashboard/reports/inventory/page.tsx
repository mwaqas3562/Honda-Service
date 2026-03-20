"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Download,
  Boxes,
  Package,
  TrendingDown,
  AlertTriangle,
  Filter,
  ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { formatRs, LoadingSpinner } from "@/components/DrillDown";

/* ─── Types ────────────────────────────────── */

interface InventoryItem {
  id: number;
  name: string;
  partNumber: string;
  category: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  stockValue: number;
  saleValue: number;
  potentialProfit: number;
  usageCount: number;
  logCount: number;
  stockIn30d: number;
  stockOut30d: number;
  status: "ok" | "low" | "out";
}

interface InvSummary {
  totalParts: number;
  totalValue: number;
  totalSaleValue: number;
  totalPotentialProfit: number;
  lowStock: number;
  outOfStock: number;
}

interface Category {
  name: string;
  count: number;
  value: number;
}

interface LedgerEntry {
  id: number;
  date: string;
  type: string;
  quantity: number;
  prevStock: number;
  newStock: number;
  purchasePrice: number | null;
  prevPrice: number | null;
  note: string | null;
}

/* ─── Component ────────────────────────────── */

export default function InventoryReportPage() {
  const sp = useSearchParams();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InvSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState(sp.get("stockFilter") || "all");
  const [sortBy, setSortBy] = useState("value");

  // Stock ledger modal
  const [ledgerPart, setLedgerPart] = useState<{ id: number; name: string; partNumber: string; stock: number; purchasePrice: number; salePrice: number } | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortBy, stockFilter });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/reports/inventory?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setSummary(data.summary);
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, stockFilter, sortBy]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Fetch stock ledger when a part is clicked
  async function openLedger(item: InventoryItem) {
    setLedgerPart(item);
    setLedgerLoading(true);
    setLedger([]);
    try {
      const res = await fetch(`/api/reports/inventory?partId=${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setLedger(data.ledger);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  }

  function exportCSV() {
    if (items.length === 0) return;
    const headers = ["Name", "Part #", "Category", "Stock", "Purchase Price", "Sale Price", "Stock Value", "Potential Profit", "Status", "In (30d)", "Out (30d)"];
    const rows = items.map((i) => [
      `"${i.name}"`, i.partNumber, i.category, i.stock, i.purchasePrice, i.salePrice, i.stockValue, i.potentialProfit, i.status, i.stockIn30d, i.stockOut30d,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusBadge = {
    ok: "bg-green-100 text-green-700",
    low: "bg-yellow-100 text-yellow-700",
    out: "bg-red-100 text-red-700",
  };

  const kpis = summary
    ? [
        { label: "Total Parts", value: summary.totalParts.toLocaleString(), icon: Package, color: "text-blue-600", bg: "bg-blue-50", filter: "all" },
        { label: "Stock Value", value: formatRs(summary.totalValue), icon: Boxes, color: "text-green-600", bg: "bg-green-50", filter: "all" },
        { label: "Low Stock", value: String(summary.lowStock), icon: TrendingDown, color: "text-yellow-600", bg: "bg-yellow-50", filter: "low" },
        { label: "Out of Stock", value: String(summary.outOfStock), icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", filter: "out" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Inventory Report"
        description="Stock valuation, movement & per-item ledger"
        action={
          items.length > 0 ? (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Download className="w-4 h-4" /> CSV
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or part number..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
              ))}
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="all">All Stock</option>
              <option value="ok">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="value">Sort: Value ↓</option>
              <option value="stock">Sort: Stock ↓</option>
              <option value="name">Sort: Name A-Z</option>
              <option value="movement">Sort: Movement ↓</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              onClick={() => setStockFilter(k.filter === stockFilter && k.filter !== "all" ? "all" : k.filter)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                stockFilter === k.filter && k.filter !== "all" ? "border-red-400 ring-1 ring-red-200" : "border-gray-200 hover:border-gray-300"
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
          <LoadingSpinner className="py-20" />
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Part</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Category</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Sale Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-green-700 text-xs uppercase tracking-wide bg-green-50/50">Value</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Profit</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">30d In/Out</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openLedger(item)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                      <div className="text-[10px] text-gray-400">{item.partNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${item.stock === 0 ? "text-red-600" : "text-gray-900"}`}>
                      {item.stock}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{formatRs(item.purchasePrice)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{formatRs(item.salePrice)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-700 bg-green-50/30">{formatRs(item.stockValue)}</td>
                    <td className={`px-4 py-3 text-right text-sm ${item.potentialProfit < 0 ? "text-red-600" : "text-gray-600"}`}>
                      {formatRs(item.potentialProfit)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-green-600">+{item.stockIn30d}</span>
                      <span className="text-gray-300 mx-1">/</span>
                      <span className="text-xs text-red-600">-{item.stockOut30d}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge[item.status]}`}>
                        {item.status === "ok" ? "OK" : item.status === "low" ? "LOW" : "OUT"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {summary && items.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <span><span className="font-semibold text-gray-900">{items.length}</span> parts</span>
            <span>
              Total Value: <span className="font-bold text-green-700">{formatRs(summary.totalValue)}</span>
              <span className="text-gray-300 mx-2">|</span>
              Potential Profit: <span className="font-bold text-emerald-700">{formatRs(summary.totalPotentialProfit)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Stock Ledger Modal */}
      <Modal
        open={!!ledgerPart}
        onClose={() => setLedgerPart(null)}
        title={ledgerPart ? `Stock Ledger — ${ledgerPart.name}` : ""}
        wide
      >
        {ledgerPart && (
          <div className="space-y-4">
            {/* Part info */}
            <div className="flex flex-wrap gap-4 text-sm bg-gray-50 rounded-lg p-3">
              <div>
                <span className="text-gray-500">Part #:</span>{" "}
                <span className="font-medium text-gray-900">{ledgerPart.partNumber}</span>
              </div>
              <div>
                <span className="text-gray-500">Stock:</span>{" "}
                <span className="font-medium text-gray-900">{ledgerPart.stock}</span>
              </div>
              <div>
                <span className="text-gray-500">Purchase:</span>{" "}
                <span className="font-medium text-gray-900">{formatRs(ledgerPart.purchasePrice)}</span>
              </div>
              <div>
                <span className="text-gray-500">Sale:</span>{" "}
                <span className="font-medium text-gray-900">{formatRs(ledgerPart.salePrice)}</span>
              </div>
            </div>

            {ledgerLoading ? (
              <LoadingSpinner className="py-10" />
            ) : ledger.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No stock movement recorded</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Date</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Type</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs">Prev</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs">New</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((l) => {
                      const isIn = l.type === "purchase";
                      return (
                        <tr key={l.id} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {new Date(l.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              isIn ? "bg-green-100 text-green-700" : l.type === "adjustment" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                            }`}>
                              {l.type}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${isIn ? "text-green-600" : "text-red-600"}`}>
                            {isIn ? "+" : ""}{l.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">{l.prevStock}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{l.newStock}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{l.note || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
