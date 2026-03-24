"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Download,
  Eye,
  Banknote,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { fmtRs } from "@/lib/utils";

/* ─── Types ──────────────────────────────────── */

interface SalaryRow {
  staffId: number;
  name: string;
  role: string;
  status: string;
  baseSalary: number;
  perDayWage: number;
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  paidDays: number;
  salary: number;
  bonus: number;
  advances: number;
  finalSalary: number;
}

interface SalaryTotals {
  baseSalary: number;
  salary: number;
  bonus: number;
  advances: number;
  finalSalary: number;
}

interface SalaryData {
  month: string;
  daysInMonth: number;
  paidLeaves: number;
  minPresentForPL: number;
  locked: boolean;
  lockedAt: string | null;
  rows: SalaryRow[];
  totals: SalaryTotals;
}

/* ─── Helpers ────────────────────────────────── */

const ROLE_LABELS: Record<string, string> = {
  job_card_person: "Job Card",
  mechanic: "Mechanic",
  store_keeper: "Store Keeper",
  wheel_balancer: "Wheel Balancer",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  job_card_person: "bg-blue-100 text-blue-700",
  mechanic: "bg-purple-100 text-purple-700",
  store_keeper: "bg-orange-100 text-orange-700",
  wheel_balancer: "bg-teal-100 text-teal-700",
  admin: "bg-gray-100 text-gray-700",
};

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ─── Component ──────────────────────────────── */

export default function SalaryPage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockConfirm, setLockConfirm] = useState(false);
  const [unlockConfirm, setUnlockConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSalary = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/salary?month=${month}`, { signal });
      if (res.ok) setData(await res.json());
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to fetch salary:", err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const c = new AbortController();
    fetchSalary(c.signal);
    return () => c.abort();
  }, [fetchSalary]);

  async function handleLock() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/salary/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      if (res.ok) {
        toast("Month locked", "success");
        fetchSalary();
      } else {
        const err = await res.json();
        toast(err.error || "Failed", "error");
      }
    } catch {
      toast("Failed to lock", "error");
    } finally {
      setLockConfirm(false);
      setActionLoading(false);
    }
  }

  async function handleUnlock() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/salary/lock?month=${month}`, { method: "DELETE" });
      if (res.ok) {
        toast("Month unlocked", "success");
        fetchSalary();
      } else {
        const err = await res.json();
        toast(err.error || "Failed", "error");
      }
    } catch {
      toast("Failed to unlock", "error");
    } finally {
      setUnlockConfirm(false);
      setActionLoading(false);
    }
  }

  function exportCSV() {
    if (!data || data.rows.length === 0) return;
    const headers = ["Staff", "Role", "Base", "Per Day", "Present", "Absent", "Paid Leaves", "Paid Days", "Salary", "Bonus", "Advance", "Final Salary"];
    const rows = data.rows.map((r) => [
      `"${r.name}"`, r.role, r.baseSalary, r.perDayWage, r.presentDays, r.absentDays,
      r.paidLeaves, r.paidDays, r.salary, r.bonus, r.advances, r.finalSalary,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salary-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Filter active staff for the main table
  const activeRows = data?.rows.filter((r) => r.status === "active") ?? [];
  const inactiveRows = data?.rows.filter((r) => r.status === "inactive") ?? [];

  return (
    <>
      <PageHeader
        title="Monthly Salary"
        description={`Daily wage — Paid leaves (max 2) only if present ≥ ${data?.minPresentForPL ?? 15} days`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/staff"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Staff
            </Link>
            {data && data.rows.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            )}
            {data && !data.locked && (
              <button
                onClick={() => setLockConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Lock Month
              </button>
            )}
            {data && data.locked && (
              <button
                onClick={() => setUnlockConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Unlock className="w-4 h-4" />
                Unlock
              </button>
            )}
          </div>
        }
      />

      {/* ── Month Selector ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">{getMonthLabel(month)}</span>
            {data?.locked && <Lock className="w-3.5 h-3.5 text-amber-500" />}
          </div>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {data && (
          <span className="text-xs text-gray-400">{data.daysInMonth} days in month</span>
        )}
      </div>

      {/* ── KPI Cards ── */}
      {data && activeRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPI icon={Banknote} label="Total Salary" value={fmtRs(data.totals.salary)} color="blue" />
          <KPI icon={TrendingUp} label="Total Bonus" value={fmtRs(data.totals.bonus)} color="green" />
          <KPI icon={TrendingDown} label="Total Advances" value={fmtRs(data.totals.advances)} color="red" />
          <KPI icon={Wallet} label="Total Payable" value={fmtRs(data.totals.finalSalary)} color="emerald" />
        </div>
      )}

      {/* ── Salary Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        ) : !data || activeRows.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active staff for salary</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-10">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Staff</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">Role</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">Base</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">Per Day</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-green-600 uppercase">P</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-600 uppercase">A</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600 uppercase" title="Paid Leaves">PL</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-indigo-600 uppercase" title="Paid Days">Paid</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase bg-gray-50/30">Salary</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-green-600 uppercase bg-green-50/30">Bonus</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-red-600 uppercase bg-red-50/30">Advance</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-emerald-700 uppercase bg-emerald-50/30">Final</th>
                  <th className="px-3 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {activeRows.map((r, idx) => (
                  <tr
                    key={r.staffId}
                    className={`border-b border-gray-100 hover:bg-yellow-50/40 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/40"}`}
                  >
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/staff/${r.staffId}`}
                        className="font-medium text-gray-900 hover:text-red-600 hover:underline transition-colors"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[r.role] || "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[r.role] || r.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{fmtRs(r.baseSalary)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{fmtRs(r.perDayWage)}</td>
                    <td className="px-3 py-2.5 text-center text-green-600 font-medium">{r.presentDays}</td>
                    <td className="px-3 py-2.5 text-center text-red-600 font-medium">{r.absentDays || <span className="text-gray-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-center text-blue-600 font-medium">{r.paidLeaves || <span className="text-gray-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-center text-indigo-600 font-medium">{r.paidDays}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900 bg-gray-50/20 font-medium">{fmtRs(r.salary)}</td>
                    <td className="px-3 py-2.5 text-right text-green-600 bg-green-50/20">{r.bonus > 0 ? fmtRs(r.bonus) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-right text-red-600 bg-red-50/20">{r.advances > 0 ? fmtRs(r.advances) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700 bg-emerald-50/20">{fmtRs(r.finalSalary)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Link
                        href={`/dashboard/staff/${r.staffId}`}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                        title="View Detail"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-900 uppercase">Total ({activeRows.length} staff)</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900">{fmtRs(data.totals.baseSalary)}</td>
                  <td colSpan={4} />
                  <td className="px-3 py-3 text-right text-sm text-gray-900 bg-gray-50/30">{fmtRs(data.totals.salary)}</td>
                  <td className="px-3 py-3 text-right text-sm text-green-700 bg-green-50/30">{fmtRs(data.totals.bonus)}</td>
                  <td className="px-3 py-3 text-right text-sm text-red-600 bg-red-50/30">{fmtRs(data.totals.advances)}</td>
                  <td className="px-3 py-3 text-right text-sm text-emerald-700 bg-emerald-50/30">{fmtRs(data.totals.finalSalary)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Inactive staff note */}
      {inactiveRows.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {inactiveRows.length} inactive staff not shown: {inactiveRows.map((r) => r.name).join(", ")}
        </p>
      )}

      {/* Lock/Unlock Confirmation */}
      <ConfirmDialog
        open={lockConfirm}
        title="Lock Month"
        message={`Lock ${getMonthLabel(month)}? No attendance or advance changes will be allowed once locked.`}
        confirmLabel="Lock"
        loading={actionLoading}
        onConfirm={handleLock}
        onCancel={() => setLockConfirm(false)}
      />
      <ConfirmDialog
        open={unlockConfirm}
        title="Unlock Month"
        message={`Unlock ${getMonthLabel(month)}? This will allow editing attendance and advances again.`}
        confirmLabel="Unlock"
        loading={actionLoading}
        onConfirm={handleUnlock}
        onCancel={() => setUnlockConfirm(false)}
      />
    </>
  );
}

/* ── KPI Card ── */
function KPI({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    green: { bg: "bg-green-50", text: "text-green-600" },
    red: { bg: "bg-red-50", text: "text-red-600" },
    orange: { bg: "bg-orange-50", text: "text-orange-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${c.text}`} />
        </div>
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
      </div>
      <div className={`text-lg font-bold ${c.text}`}>{value}</div>
    </div>
  );
}
