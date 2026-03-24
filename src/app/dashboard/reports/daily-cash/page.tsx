"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Download,
  ArrowLeft,
  Banknote,
  TrendingUp,
  TrendingDown,
  Wallet,
  Eye,
  ShoppingCart,
  Wrench,
  Truck,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Hash,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { formatRs, formatDateFull as formatDate, DetailSection, EmptyState, PayBadge, StatusBadge, LoadingSpinner } from "@/components/DrillDown";
import Link from "next/link";
import { today, monthStart, monthEnd, getDatePresets, parseDateParams } from "@/lib/report-filters";

/* ─── Types ──────────────────────────────────────── */

interface DailyCashEntry {
  id: number;
  date: string;
  totalSales: number;
  foodExpense: number;
  otherExpense: number;
  totalExpenses: number;
  purchaseFromSales: number;
  onlineCash: number;
  cashInHand: number;
  advanceSalary: number;
  takeHomeCash: number;
  notes: string | null;
}

interface Totals {
  totalSales: number;
  foodExpense: number;
  otherExpense: number;
  totalExpenses: number;
  purchaseFromSales: number;
  onlineCash: number;
  cashInHand: number;
  advanceSalary: number;
  takeHomeCash: number;
}

/* ─── Detail drill-down types ────────────────────── */

interface DetailItem { name: string; partNumber?: string; qty: number; price: number; total: number }

interface DetailSale {
  id: number; ref: string; customer: string; paymentType: string; status: string;
  subtotal: number; laborCost: number; discount: number; total: number;
  items: DetailItem[]; labourItems: { name: string; qty: number; price: number; total: number }[];
}

interface DetailService {
  id: number; customer: string; bike: string; serviceType: string; status: string;
  laborCost: number; total: number; items: DetailItem[];
}

interface DetailPurchase {
  id: number; vendor: string; status: string; total: number; note: string | null;
  items: DetailItem[];
}

interface DayDetail {
  date: string;
  sales: DetailSale[];
  services: DetailService[];
  purchases: DetailPurchase[];
  expenses: { foodExpense: number; otherExpense: number; totalExpenses: number; notes: string | null } | null;
  expenseRecords: { id: number; amount: number; type: string; note: string | null; date: string }[];
  cashInfo: { onlineCash: number; purchaseFromSales: number; advanceSalary: number } | null;
  summary: { salesCount: number; salesTotal: number; servicesCount: number; servicesTotal: number; purchasesCount: number; purchasesTotal: number };
}

interface FormData {
  date: string;
  advanceSalary: string;
  notes: string;
}

/* ─── Helpers ────────────────────────────────────── */

const emptyForm: FormData = {
  date: today(),
  advanceSalary: "",
  notes: "",
};

/* ─── Quick Date Presets ─────────────────────────── */

type Preset = { label: string; from: string; to: string };

// Delegate to centralized presets
const getPresets = getDatePresets;

/* ─── Sortable column keys ───────────────────────── */

type SortKey =
  | "date"
  | "totalSales"
  | "foodExpense"
  | "otherExpense"
  | "totalExpenses"
  | "purchaseFromSales"
  | "onlineCash"
  | "cashInHand"
  | "advanceSalary"
  | "takeHomeCash";

/* ─── Component ──────────────────────────────────── */

function DailyCashReportPageContent() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const urlDates = parseDateParams(sp, monthStart(), monthEnd());

  /* ── State ── */
  const [entries, setEntries] = useState<DailyCashEntry[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState(urlDates.from);
  const [dateTo, setDateTo] = useState(urlDates.to);
  const [activePreset, setActivePreset] = useState(urlDates.fromUrl ? "" : "This Month");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyCashEntry | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DailyCashEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Detail drill-down
  const [detailEntry, setDetailEntry] = useState<DailyCashEntry | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const presets = getPresets();

  /* ── Fetch ── */
  const fetchEntries = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const res = await fetch(`/api/reports/daily-cash?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotals(data.totals);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to fetch daily cash:", err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const c = new AbortController();
    fetchEntries(c.signal);
    return () => c.abort();
  }, [fetchEntries]);

  /* ── Preset click ── */
  function applyPreset(p: Preset) {
    setDateFrom(p.from);
    setDateTo(p.to);
    setActivePreset(p.label);
  }

  /* ── Open detail drawer ── */
  async function openDetail(entry: DailyCashEntry) {
    setDetailEntry(entry);
    setDayDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/reports/daily-cash/detail?date=${entry.date}`);
      if (res.ok) setDayDetail(await res.json());
    } catch (err) {
      console.error("Failed to fetch detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  /* ── Open modal ── */
  function openNew() {
    setEditingEntry(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(entry: DailyCashEntry) {
    setEditingEntry(entry);
    setForm({
      date: entry.date,
      advanceSalary: String(entry.advanceSalary),
      notes: entry.notes || "",
    });
    setShowModal(true);
  }

  /* ── Save ── */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) return;

    setSaving(true);
    try {
      const res = await fetch("/api/reports/daily-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast(editingEntry ? "Entry updated" : "Entry added", "success");
      setShowModal(false);
      fetchEntries();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ── */
  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/reports/daily-cash?id=${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast("Entry deleted", "success");
      setDeleteTarget(null);
      fetchEntries();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setActionLoading(false);
    }
  }

  /* ── CSV Export ── */
  function exportCSV() {
    if (entries.length === 0) return;
    const headers = [
      "Date",
      "Total Sales",
      "Food Expense",
      "Other Expenses",
      "Total Expenses",
      "Purchase From Sales",
      "Online Cash",
      "Cash In Hand",
      "Advance Salary",
      "Take Home Cash",
      "Notes",
    ];
    const rows = entries.map((e) => [
      e.date,
      e.totalSales,
      e.foodExpense,
      e.otherExpense,
      e.totalExpenses,
      e.purchaseFromSales,
      e.onlineCash,
      e.cashInHand,
      e.advanceSalary,
      e.takeHomeCash,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-cash-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Sorting ── */
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  }

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string")
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc"
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return sorted;
  }, [entries, sortKey, sortDir]);

  /* ── Cumulative take-home (running total by date order) ── */
  const cumulativeMap = useMemo(() => {
    const byDate = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map<string, number>();
    let running = 0;
    for (const e of byDate) {
      running += e.takeHomeCash;
      map.set(e.date, running);
    }
    return map;
  }, [entries]);

  /* ── Averages ── */
  const averages = useMemo(() => {
    if (entries.length === 0 || !totals) return null;
    const n = entries.length;
    return {
      totalSales: totals.totalSales / n,
      foodExpense: totals.foodExpense / n,
      otherExpense: totals.otherExpense / n,
      totalExpenses: totals.totalExpenses / n,
      purchaseFromSales: totals.purchaseFromSales / n,
      onlineCash: totals.onlineCash / n,
      cashInHand: totals.cashInHand / n,
      advanceSalary: totals.advanceSalary / n,
      takeHomeCash: totals.takeHomeCash / n,
    };
  }, [entries, totals]);

  /* ── KPI Cards ── */
  const kpis = totals
    ? [
        {
          label: "Total Sales",
          value: formatRs(totals.totalSales),
          icon: TrendingUp,
          color: "text-green-600",
          bg: "bg-green-50",
        },
        {
          label: "Total Expenses",
          value: formatRs(totals.totalExpenses),
          icon: TrendingDown,
          color: "text-red-600",
          bg: "bg-red-50",
        },
        {
          label: "Purchases",
          value: formatRs(totals.purchaseFromSales),
          icon: Truck,
          color: "text-orange-600",
          bg: "bg-orange-50",
        },
        {
          label: "Online / Card",
          value: formatRs(totals.onlineCash),
          icon: CreditCard,
          color: "text-purple-600",
          bg: "bg-purple-50",
        },
        {
          label: "Cash In Hand",
          value: formatRs(totals.cashInHand),
          icon: Wallet,
          color: totals.cashInHand >= 0 ? "text-blue-600" : "text-red-600",
          bg: totals.cashInHand >= 0 ? "bg-blue-50" : "bg-red-50",
        },
        {
          label: "Take Home Cash",
          value: formatRs(totals.takeHomeCash),
          icon: Banknote,
          color: totals.takeHomeCash >= 0 ? "text-emerald-600" : "text-red-600",
          bg: totals.takeHomeCash >= 0 ? "bg-emerald-50" : "bg-red-50",
        },
      ]
    : [];

  /* ── Input helper ── */
  function field(
    label: string,
    key: keyof FormData,
    type: "number" | "text" | "date" = "number",
    placeholder = "0"
  ) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder={placeholder}
        />
      </div>
    );
  }

  /* ── Value cell with negative highlight ── */
  function valCell(n: number, bold = false, bgClass = "") {
    const neg = n < 0;
    return (
      <td
        className={`px-3 py-2.5 text-right text-sm whitespace-nowrap ${bgClass} ${
          neg ? "text-red-600 font-semibold" : bold ? "font-semibold text-gray-900" : "text-gray-700"
        }`}
      >
        {formatRs(n)}
      </td>
    );
  }

  /* ── Sortable column header ── */
  function sortHeader(label: string, key: SortKey, extraClass = "") {
    const active = sortKey === key;
    return (
      <th
        onClick={() => toggleSort(key)}
        className={`text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide cursor-pointer select-none group transition-colors hover:bg-gray-100 ${extraClass}`}
      >
        <span className="inline-flex items-center gap-1 justify-end">
          {label}
          <span className="inline-flex flex-col -space-y-1">
            <ChevronUp
              className={`w-3 h-3 ${
                active && sortDir === "asc" ? "text-red-600" : "text-gray-300 group-hover:text-gray-400"
              }`}
            />
            <ChevronDown
              className={`w-3 h-3 ${
                active && sortDir === "desc" ? "text-red-600" : "text-gray-300 group-hover:text-gray-400"
              }`}
            />
          </span>
        </span>
      </th>
    );
  }

  return (
    <>
      <PageHeader
        title="Daily General Report"
        description="Track daily cash flow — sales, expenses, purchases & take-home"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/reports"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Reports
            </Link>
            {entries.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            )}
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Salary / Notes
            </button>
          </div>
        }
      />

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          {/* Presets */}
          <div className="flex gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activePreset === p.label
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 ml-auto">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePreset("");
              }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePreset("");
              }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {totals && entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="bg-white rounded-xl border border-gray-200 p-4"
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

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No entries for this period</p>
            <p className="text-sm mt-1">Click &quot;Add Entry&quot; to get started</p>
          </div>
        ) : (
          <>
            {/* Entry count badge */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">
                  {entries.length} {entries.length === 1 ? "day" : "days"} •{" "}
                  Avg daily take-home:{" "}
                  <span className={`font-bold ${averages && averages.takeHomeCash >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {averages ? formatRs(averages.takeHomeCash) : "—"}
                  </span>
                </span>
              </div>
              <span className="text-xs text-gray-400">Click column headers to sort</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {/* ── Column Group Headers ── */}
                <thead>
                  <tr className="border-b border-gray-100">
                    <th colSpan={2} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50/50" />
                    <th colSpan={1} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-50/30 border-l border-green-100">
                      Revenue
                    </th>
                    <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-50/30 border-l border-red-100">
                      Expenses
                    </th>
                    <th colSpan={2} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-orange-500 bg-orange-50/30 border-l border-orange-100">
                      Deductions
                    </th>
                    <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50/30 border-l border-blue-100">
                      Cash Summary
                    </th>
                    <th colSpan={2} className="px-3 py-1.5 bg-gray-50/50" />
                  </tr>

                  {/* ── Column Headers ── */}
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-400 text-xs w-10">#</th>
                    <th
                      onClick={() => toggleSort("date")}
                      className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide cursor-pointer select-none group hover:bg-gray-100 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        Date
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`w-3 h-3 ${sortKey === "date" && sortDir === "asc" ? "text-red-600" : "text-gray-300 group-hover:text-gray-400"}`} />
                          <ChevronDown className={`w-3 h-3 ${sortKey === "date" && sortDir === "desc" ? "text-red-600" : "text-gray-300 group-hover:text-gray-400"}`} />
                        </span>
                      </span>
                    </th>
                    {sortHeader("Sales", "totalSales", "text-green-700 bg-green-50/30 border-l border-green-100")}
                    {sortHeader("Food", "foodExpense", "text-red-600 bg-red-50/20 border-l border-red-100")}
                    {sortHeader("Other", "otherExpense", "text-red-600 bg-red-50/20")}
                    {sortHeader("Total Exp", "totalExpenses", "text-red-700 bg-red-50/30")}
                    {sortHeader("Purchase", "purchaseFromSales", "text-orange-600 bg-orange-50/20 border-l border-orange-100")}
                    {sortHeader("Online", "onlineCash", "text-orange-600 bg-orange-50/20")}
                    {sortHeader("Cash In Hand", "cashInHand", "text-blue-700 bg-blue-50/30 border-l border-blue-100")}
                    {sortHeader("Adv Salary", "advanceSalary", "text-blue-600 bg-blue-50/20")}
                    {sortHeader("Take Home", "takeHomeCash", "text-emerald-700 bg-emerald-50/30")}
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide bg-gray-50">
                      Running
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      Notes
                    </th>
                    <th className="px-3 py-2.5 w-24" />
                  </tr>
                </thead>

                <tbody>
                  {sortedEntries.map((e, idx) => (
                    <tr
                      key={e.id}
                      onClick={() => openDetail(e)}
                      className={`border-b border-gray-100 hover:bg-yellow-50/40 transition-colors cursor-pointer ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                      }`}
                    >
                      {/* Row number */}
                      <td className="px-2 py-2.5 text-center text-xs text-gray-400 font-mono">
                        {idx + 1}
                      </td>
                      {/* Date */}
                      <td
                        className="px-3 py-2.5 text-sm font-medium text-red-600 whitespace-nowrap hover:underline"
                        title="View daily breakdown"
                      >
                        {formatDate(e.date)}
                      </td>
                      {/* Sales */}
                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-green-700 whitespace-nowrap bg-green-50/20 border-l border-green-100/50">
                        {formatRs(e.totalSales)}
                      </td>
                      {/* Food Exp */}
                      {valCell(e.foodExpense, false, "bg-red-50/10 border-l border-red-100/50")}
                      {/* Other Exp */}
                      {valCell(e.otherExpense, false, "bg-red-50/10")}
                      {/* Total Exp */}
                      <td
                        className={`px-3 py-2.5 text-right text-sm font-medium whitespace-nowrap bg-red-50/20 ${
                          e.totalExpenses < 0 ? "text-red-600" : "text-red-700"
                        }`}
                      >
                        {formatRs(e.totalExpenses)}
                      </td>
                      {/* Purchase */}
                      {valCell(e.purchaseFromSales, false, "bg-orange-50/10 border-l border-orange-100/50")}
                      {/* Online */}
                      {valCell(e.onlineCash, false, "bg-orange-50/10")}
                      {/* Cash In Hand */}
                      <td
                        className={`px-3 py-2.5 text-right text-sm font-semibold whitespace-nowrap bg-blue-50/20 border-l border-blue-100/50 ${
                          e.cashInHand < 0 ? "text-red-600" : "text-blue-700"
                        }`}
                      >
                        {formatRs(e.cashInHand)}
                      </td>
                      {/* Adv Salary */}
                      {valCell(e.advanceSalary, false, "bg-blue-50/10")}
                      {/* Take Home */}
                      <td
                        className={`px-3 py-2.5 text-right text-sm font-bold whitespace-nowrap bg-emerald-50/20 ${
                          e.takeHomeCash < 0 ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {formatRs(e.takeHomeCash)}
                      </td>
                      {/* Running cumulative */}
                      <td className={`px-3 py-2.5 text-right text-xs font-mono whitespace-nowrap bg-gray-50/50 ${
                        (cumulativeMap.get(e.date) ?? 0) < 0 ? "text-red-500" : "text-gray-500"
                      }`}>
                        {formatRs(cumulativeMap.get(e.date) ?? 0)}
                      </td>
                      {/* Notes */}
                      <td className="px-3 py-2.5 text-sm text-gray-500 max-w-[150px]" title={e.notes || undefined}>
                        <span className="block truncate">{e.notes || "—"}</span>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            onClick={() => openDetail(e)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="View Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(e)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(e)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* ── Totals + Averages Footer ── */}
                {totals && (
                  <tfoot className="sticky bottom-0">
                    {/* Totals Row */}
                    <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                      <td className="px-2 py-2.5" />
                      <td className="px-3 py-2.5 text-sm text-gray-900 uppercase tracking-wide">Total</td>
                      <td className="px-3 py-2.5 text-right text-sm font-bold text-green-700 whitespace-nowrap bg-green-50/40 border-l border-green-100/50">
                        {formatRs(totals.totalSales)}
                      </td>
                      {valCell(totals.foodExpense, true, "bg-red-50/20 border-l border-red-100/50")}
                      {valCell(totals.otherExpense, true, "bg-red-50/20")}
                      <td className={`px-3 py-2.5 text-right text-sm font-bold whitespace-nowrap bg-red-50/30 ${totals.totalExpenses < 0 ? "text-red-600" : "text-red-700"}`}>
                        {formatRs(totals.totalExpenses)}
                      </td>
                      {valCell(totals.purchaseFromSales, true, "bg-orange-50/20 border-l border-orange-100/50")}
                      {valCell(totals.onlineCash, true, "bg-orange-50/20")}
                      <td className={`px-3 py-2.5 text-right text-sm font-bold whitespace-nowrap bg-blue-50/30 border-l border-blue-100/50 ${totals.cashInHand < 0 ? "text-red-600" : "text-blue-700"}`}>
                        {formatRs(totals.cashInHand)}
                      </td>
                      {valCell(totals.advanceSalary, true, "bg-blue-50/20")}
                      <td className={`px-3 py-2.5 text-right text-sm font-bold whitespace-nowrap bg-emerald-50/30 ${totals.takeHomeCash < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {formatRs(totals.takeHomeCash)}
                      </td>
                      <td className="bg-gray-100" />
                      <td colSpan={2} />
                    </tr>

                    {/* Averages Row */}
                    {averages && (
                      <tr className="bg-gray-50 border-t border-gray-200 text-gray-500">
                        <td className="px-2 py-2" />
                        <td className="px-3 py-2 text-xs font-medium uppercase tracking-wide">Avg / Day</td>
                        <td className="px-3 py-2 text-right text-xs font-medium whitespace-nowrap bg-green-50/20 border-l border-green-100/50">
                          {formatRs(averages.totalSales)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs whitespace-nowrap bg-red-50/10 border-l border-red-100/50">{formatRs(averages.foodExpense)}</td>
                        <td className="px-3 py-2 text-right text-xs whitespace-nowrap bg-red-50/10">{formatRs(averages.otherExpense)}</td>
                        <td className="px-3 py-2 text-right text-xs font-medium whitespace-nowrap bg-red-50/20">{formatRs(averages.totalExpenses)}</td>
                        <td className="px-3 py-2 text-right text-xs whitespace-nowrap bg-orange-50/10 border-l border-orange-100/50">{formatRs(averages.purchaseFromSales)}</td>
                        <td className="px-3 py-2 text-right text-xs whitespace-nowrap bg-orange-50/10">{formatRs(averages.onlineCash)}</td>
                        <td className="px-3 py-2 text-right text-xs font-medium whitespace-nowrap bg-blue-50/20 border-l border-blue-100/50">{formatRs(averages.cashInHand)}</td>
                        <td className="px-3 py-2 text-right text-xs whitespace-nowrap bg-blue-50/10">{formatRs(averages.advanceSalary)}</td>
                        <td className={`px-3 py-2 text-right text-xs font-medium whitespace-nowrap bg-emerald-50/20 ${averages.takeHomeCash < 0 ? "text-red-500" : "text-emerald-600"}`}>
                          {formatRs(averages.takeHomeCash)}
                        </td>
                        <td className="bg-gray-50" />
                        <td colSpan={2} />
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingEntry ? "Edit Manual Entry" : "Add Manual Entry"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {field("Date", "date", "date", "")}

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            Sales, expenses, purchases, and online cash are computed automatically from transaction data. Only advance salary and notes need manual entry.
          </div>

          {field("Advance Salary", "advanceSalary")}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows={2}
              placeholder="e.g. Salary advance for Ali, vendor payment..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editingEntry ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Day Detail Drawer ── */}
      <Modal
        open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        title={detailEntry ? `Daily Breakdown — ${formatDate(detailEntry.date)}` : ""}
        wide
      >
        {detailLoading ? (
          <LoadingSpinner />
        ) : dayDetail ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                <ShoppingCart className="w-3.5 h-3.5" />
                {dayDetail.summary.salesCount} Sales — {formatRs(dayDetail.summary.salesTotal)}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                <Wrench className="w-3.5 h-3.5" />
                {dayDetail.summary.servicesCount} Services — {formatRs(dayDetail.summary.servicesTotal)}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                <Truck className="w-3.5 h-3.5" />
                {dayDetail.summary.purchasesCount} Purchases — {formatRs(dayDetail.summary.purchasesTotal)}
              </span>
            </div>

            {/* ─── Section 1: Sales Breakdown ─── */}
            <DetailSection title="Sales Breakdown" icon={ShoppingCart} color="green" count={dayDetail.sales.length}>
              {dayDetail.sales.length === 0 ? (
                <EmptyState text="No sales recorded" />
              ) : (
                <div className="space-y-3">
                  {dayDetail.sales.map((s) => (
                    <div key={s.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">{s.ref}</span>
                          <span className="text-xs text-gray-500">{s.customer}</span>
                          <PayBadge type={s.paymentType} />
                          <StatusBadge status={s.status} />
                        </div>
                        <span className="text-sm font-bold text-green-700">{formatRs(s.total)}</span>
                      </div>
                      {(s.items.length > 0 || s.labourItems.length > 0) && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-t border-gray-100 text-gray-500">
                              <th className="text-left px-4 py-1.5 font-medium">Item</th>
                              <th className="text-center px-2 py-1.5 font-medium w-16">Qty</th>
                              <th className="text-right px-2 py-1.5 font-medium w-20">Price</th>
                              <th className="text-right px-4 py-1.5 font-medium w-24">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((it, i) => (
                              <tr key={i} className="border-t border-gray-50">
                                <td className="px-4 py-1.5 text-gray-700">{it.name}</td>
                                <td className="px-2 py-1.5 text-center text-gray-600">{it.qty}</td>
                                <td className="px-2 py-1.5 text-right text-gray-600">{formatRs(it.price)}</td>
                                <td className="px-4 py-1.5 text-right font-medium text-gray-900">{formatRs(it.total)}</td>
                              </tr>
                            ))}
                            {s.labourItems.map((l, i) => (
                              <tr key={`l-${i}`} className="border-t border-gray-50 bg-purple-50/30">
                                <td className="px-4 py-1.5 text-purple-700">{l.name} <span className="text-purple-400">(Labour)</span></td>
                                <td className="px-2 py-1.5 text-center text-purple-600">{l.qty}</td>
                                <td className="px-2 py-1.5 text-right text-purple-600">{formatRs(l.price)}</td>
                                <td className="px-4 py-1.5 text-right font-medium text-purple-700">{formatRs(l.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

            {/* ─── Section 2: Services ─── */}
            <DetailSection title="Services" icon={Wrench} color="blue" count={dayDetail.services.length}>
              {dayDetail.services.length === 0 ? (
                <EmptyState text="No services recorded" />
              ) : (
                <div className="space-y-3">
                  {dayDetail.services.map((s) => (
                    <div key={s.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">{s.customer}</span>
                          <span className="text-xs text-gray-500">{s.bike}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{s.serviceType}</span>
                        </div>
                        <span className="text-sm font-bold text-blue-700">{formatRs(s.total)}</span>
                      </div>
                      {s.items.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-t border-gray-100 text-gray-500">
                              <th className="text-left px-4 py-1.5 font-medium">Part</th>
                              <th className="text-center px-2 py-1.5 font-medium w-16">Qty</th>
                              <th className="text-right px-2 py-1.5 font-medium w-20">Price</th>
                              <th className="text-right px-4 py-1.5 font-medium w-24">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((it, i) => (
                              <tr key={i} className="border-t border-gray-50">
                                <td className="px-4 py-1.5 text-gray-700">{it.name}</td>
                                <td className="px-2 py-1.5 text-center text-gray-600">{it.qty}</td>
                                <td className="px-2 py-1.5 text-right text-gray-600">{formatRs(it.price)}</td>
                                <td className="px-4 py-1.5 text-right font-medium text-gray-900">{formatRs(it.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

            {/* ─── Section 3: Expense Breakdown ─── */}
            <DetailSection title="Expense Breakdown" icon={TrendingDown} color="red" count={(dayDetail.expenses ? 1 : 0) + dayDetail.expenseRecords.length}>
              {!dayDetail.expenses && dayDetail.expenseRecords.length === 0 ? (
                <EmptyState text="No expense data for this date" />
              ) : (
                <div className="space-y-3">
                  {/* Manual cash entry expenses */}
                  {dayDetail.expenses && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Manual Entry</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Food Expense</span>
                          <div className="font-semibold text-gray-900">{formatRs(dayDetail.expenses.foodExpense)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Other Expenses</span>
                          <div className="font-semibold text-gray-900">{formatRs(dayDetail.expenses.otherExpense)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Total</span>
                          <div className="font-bold text-red-600">{formatRs(dayDetail.expenses.totalExpenses)}</div>
                        </div>
                      </div>
                      {dayDetail.expenses.notes && (
                        <p className="mt-3 text-xs text-gray-500 border-t border-gray-200 pt-2">
                          Notes: {dayDetail.expenses.notes}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Actual expense records */}
                  {dayDetail.expenseRecords.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-red-600 mb-2">Expense Records ({dayDetail.expenseRecords.length})</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500">
                            <th className="text-left pb-1">Type</th>
                            <th className="text-right pb-1">Amount</th>
                            <th className="text-left pb-1 pl-3">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetail.expenseRecords.map((er) => (
                            <tr key={er.id} className="border-t border-red-100">
                              <td className="py-1 capitalize">{er.type}</td>
                              <td className="py-1 text-right font-semibold text-red-600">{formatRs(er.amount)}</td>
                              <td className="py-1 pl-3 text-gray-500 truncate max-w-[150px]">{er.note || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-red-200 font-bold">
                            <td className="pt-1">Total</td>
                            <td className="pt-1 text-right text-red-700">{formatRs(dayDetail.expenseRecords.reduce((s, e) => s + e.amount, 0))}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </DetailSection>

            {/* ─── Section 4: Purchases from Sales ─── */}
            <DetailSection title="Purchases from Sales" icon={Truck} color="orange" count={dayDetail.purchases.length}>
              {dayDetail.purchases.length === 0 && !dayDetail.cashInfo?.purchaseFromSales ? (
                <EmptyState text="No purchases recorded" />
              ) : (
                <div className="space-y-3">
                  {dayDetail.cashInfo && dayDetail.cashInfo.purchaseFromSales > 0 && (
                    <div className="bg-orange-50 rounded-lg p-4 flex items-center justify-between">
                      <span className="text-sm text-orange-700">Manual entry — Purchase from Sales</span>
                      <span className="text-sm font-bold text-orange-700">{formatRs(dayDetail.cashInfo.purchaseFromSales)}</span>
                    </div>
                  )}
                  {dayDetail.purchases.map((p) => (
                    <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">{p.vendor}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <span className="text-sm font-bold text-orange-700">{formatRs(p.total)}</span>
                      </div>
                      {p.items.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-t border-gray-100 text-gray-500">
                              <th className="text-left px-4 py-1.5 font-medium">Part</th>
                              <th className="text-center px-2 py-1.5 font-medium w-16">Qty</th>
                              <th className="text-right px-2 py-1.5 font-medium w-20">Price</th>
                              <th className="text-right px-4 py-1.5 font-medium w-24">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.items.map((it, i) => (
                              <tr key={i} className="border-t border-gray-50">
                                <td className="px-4 py-1.5 text-gray-700">{it.name}</td>
                                <td className="px-2 py-1.5 text-center text-gray-600">{it.qty}</td>
                                <td className="px-2 py-1.5 text-right text-gray-600">{formatRs(it.price)}</td>
                                <td className="px-4 py-1.5 text-right font-medium text-gray-900">{formatRs(it.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

            {/* ─── Section 5: Online & Salary Payments ─── */}
            <DetailSection title="Online & Salary Payments" icon={Banknote} color="emerald" count={dayDetail.cashInfo ? 1 : 0}>
              {!dayDetail.cashInfo ? (
                <EmptyState text="No payment data for this date" />
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">Online Cash / Card</span>
                      <div className="font-semibold text-blue-700">{formatRs(dayDetail.cashInfo.onlineCash)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Advance Salary</span>
                      <div className="font-semibold text-red-600">{formatRs(dayDetail.cashInfo.advanceSalary)}</div>
                    </div>
                  </div>
                </div>
              )}
            </DetailSection>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8">Failed to load detail</p>
        )}
      </Modal>

      {/* ── Delete Confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Entry"
        message={
          deleteTarget
            ? `Delete entry for ${formatDate(deleteTarget.date)}?`
            : ""
        }
        confirmLabel="Delete"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

export default function DailyCashReportPage() {
  return <Suspense><DailyCashReportPageContent /></Suspense>;
}
