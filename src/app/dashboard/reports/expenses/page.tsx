"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Download,
  Plus,
  Trash2,
  Receipt,
  UtensilsCrossed,
  Zap,
  HelpCircle,
  Filter,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import IntegerInput from "@/components/IntegerInput";
import { formatRs, formatDate, LoadingSpinner } from "@/components/DrillDown";
import { today, monthStart, getDatePresets, parseDateParams } from "@/lib/report-filters";

/* ─── Types ───────────────────────────────────── */

interface Expense {
  id: number;
  amount: number;
  type: string;
  note: string | null;
  date: string;
  createdAt: string;
}

interface FormData {
  amount: string;
  type: string;
  note: string;
  date: string;
}

/* ─── Helpers ────────────────────────────────── */


const typeConfig: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  food: { label: "Food", cls: "bg-orange-100 text-orange-700", icon: UtensilsCrossed },
  utility: { label: "Utility", cls: "bg-blue-100 text-blue-700", icon: Zap },
  misc: { label: "Misc", cls: "bg-gray-100 text-gray-700", icon: HelpCircle },
};

type Preset = { label: string; from: string; to: string };

const emptyForm: FormData = { amount: "", type: "food", note: "", date: today() };

/* ─── Component ──────────────────────────────── */

function ExpensesReportPageContent() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const urlDates = parseDateParams(sp, monthStart(), today());

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(urlDates.from);
  const [dateTo, setDateTo] = useState(urlDates.to);
  const [typeFilter, setTypeFilter] = useState(sp.get("type") || "all");
  const [activePreset, setActivePreset] = useState(urlDates.fromUrl ? "" : "This Month");

  // Add modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const presets = getDatePresets();

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/expenses?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses);
        setTotal(data.total);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, typeFilter]);

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

  async function handleSave() {
    if (!form.amount || !form.type || !form.date) {
      toast("Please fill all required fields", "error");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast("Amount must be a positive number", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          type: form.type,
          note: form.note || null,
          date: form.date,
        }),
      });
      if (res.ok) {
        toast("Expense added", "success");
        setShowModal(false);
        setForm({ ...emptyForm });
        fetchData();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to save", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/expenses?id=${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Expense deleted", "success");
        fetchData();
      } else {
        toast("Failed to delete", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setDeleteId(null);
      setActionLoading(false);
    }
  }

  function exportCSV() {
    if (expenses.length === 0) return;
    const header = "Date,Type,Amount,Note";
    const rows = expenses.map(
      (e) =>
        `${formatDate(e.date)},${e.type},${e.amount},"${(e.note || "").replace(/"/g, '""')}"`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // KPI cards
  const foodTotal = expenses.filter((e) => e.type === "food").reduce((s, e) => s + e.amount, 0);
  const utilityTotal = expenses.filter((e) => e.type === "utility").reduce((s, e) => s + e.amount, 0);
  const miscTotal = expenses.filter((e) => e.type === "misc").reduce((s, e) => s + e.amount, 0);

  const kpiCards = [
    { label: "Total Expenses", value: formatRs(total), color: "red", count: expenses.length },
    { label: "Food", value: formatRs(foodTotal), color: "orange", type: "food" },
    { label: "Utility", value: formatRs(utilityTotal), color: "blue", type: "utility" },
    { label: "Misc", value: formatRs(miscTotal), color: "gray", type: "misc" },
  ];

  const kpiColorMap: Record<string, string> = {
    red: "border-red-200 bg-red-50",
    orange: "border-orange-200 bg-orange-50",
    blue: "border-blue-200 bg-blue-50",
    gray: "border-gray-200 bg-gray-50",
  };
  const kpiTextMap: Record<string, string> = { red: "text-red-600", orange: "text-orange-600", blue: "text-blue-600", gray: "text-gray-600" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses Report"
        description="Track and manage all shop expenses"
        action={
          <button
            onClick={() => {
              setForm({ ...emptyForm });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        }
      />

      {/* ─── Filters ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        {/* Presets */}
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
        {/* Date + type + export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Types</option>
              <option value="food">Food</option>
              <option value="utility">Utility</option>
              <option value="misc">Misc</option>
            </select>
          </div>
          <button
            onClick={exportCSV}
            disabled={expenses.length === 0}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((c) => (
          <button
            key={c.label}
            onClick={() => {
              if (c.type) {
                setTypeFilter(typeFilter === c.type ? "all" : c.type);
              } else {
                setTypeFilter("all");
              }
            }}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${kpiColorMap[c.color]}`}
          >
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${kpiTextMap[c.color]}`}>{c.value}</p>
            {c.count !== undefined && (
              <p className="text-xs text-gray-400 mt-1">{c.count} entries</p>
            )}
          </button>
        ))}
      </div>

      {/* ─── Table ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="py-20" />
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Receipt className="h-12 w-12 mb-3" />
            <p className="font-medium">No expenses found</p>
            <p className="text-sm">Try changing filters or add a new expense</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Type</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Note</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3 w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map((e) => {
                  const tc = typeConfig[e.type] || typeConfig.misc;
                  const Icon = tc.icon;
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tc.cls}`}>
                          <Icon className="h-3 w-3" /> {tc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatRs(e.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{e.note || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setDeleteId(e.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Total ({expenses.length} entries)
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatRs(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add Expense Modal ─── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Expense">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="food">Food</option>
              <option value="utility">Utility</option>
              <option value="misc">Misc</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs) *</label>
            <IntegerInput
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional note"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Expense"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete Confirm ─── */}
      <ConfirmDialog
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={actionLoading}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
      />
    </div>
  );
}
export default function ExpensesReportPage() {
  return <Suspense><ExpensesReportPageContent /></Suspense>;
}