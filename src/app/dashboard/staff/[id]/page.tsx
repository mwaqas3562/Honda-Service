"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Clock,
  TrendingUp,
  Wallet,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { fmtRs } from "@/lib/utils";

/* ─── Types ──────────────────────────────────── */

interface Staff {
  id: number;
  name: string;
  role: string;
  contact: string | null;
  status: string;
  baseSalary: number;
}

interface AttendanceRecord {
  id: number;
  staffId: number;
  date: string;
  status: string;
}

interface AdvanceRecord {
  id: number;
  staffId: number;
  amount: number;
  date: string;
  note: string | null;
}

interface SalaryRow {
  staffId: number;
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

/* ─── Helpers ────────────────────────────────── */

const ROLE_LABELS: Record<string, string> = {
  job_card_person: "Job Card Person",
  mechanic: "Mechanic",
  store_keeper: "Store Keeper",
  wheel_balancer: "Wheel Balancer",
  admin: "Admin",
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

function getDaysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}

/* ─── Component ──────────────────────────────── */

export default function StaffDetailPage() {
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const staffId = parseInt(id);

  const [staff, setStaff] = useState<Staff | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [salaryRow, setSalaryRow] = useState<SalaryRow | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Advance form
  const [showAdvForm, setShowAdvForm] = useState(false);
  const [advAmount, setAdvAmount] = useState("");
  const [advDate, setAdvDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [advNote, setAdvNote] = useState("");
  const [advSaving, setAdvSaving] = useState(false);

  // Delete advance
  const [deleteAdvId, setDeleteAdvId] = useState<number | null>(null);

  const daysInMonth = getDaysInMonth(month);

  /* ── Fetch staff info ── */
  useEffect(() => {
    fetch(`/api/staff?search=`)
      .then((r) => r.json())
      .then((list: Staff[]) => {
        const s = list.find((x: Staff) => x.id === staffId);
        if (s) setStaff(s);
      });
  }, [staffId]);

  /* ── Fetch month data ── */
  const fetchMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, advRes, salRes] = await Promise.all([
        fetch(`/api/staff/${staffId}/attendance?month=${month}`),
        fetch(`/api/staff/${staffId}/advances?month=${month}`),
        fetch(`/api/salary?month=${month}`),
      ]);

      if (attRes.ok) setAttendance(await attRes.json());
      if (advRes.ok) setAdvances(await advRes.json());
      if (salRes.ok) {
        const salData = await salRes.json();
        setLocked(salData.locked);
        const row = salData.rows?.find((r: SalaryRow) => r.staffId === staffId);
        if (row) setSalaryRow(row);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [staffId, month]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  /* ── Attendance map (date string → status) ── */
  const attendanceMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of attendance) {
      const day = new Date(a.date).getDate();
      map.set(day, a.status);
    }
    return map;
  }, [attendance]);

  /* ── Toggle attendance for a day ── */
  async function toggleDay(day: number) {
    if (locked) {
      toast("Month is locked", "error");
      return;
    }
    const [y, m] = month.split("-").map(Number);
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Don't allow future dates (compare as strings to avoid timezone issues)
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local TZ
    if (dateStr > todayStr) {
      toast("Cannot mark future dates", "error");
      return;
    }

    const current = attendanceMap.get(day);
    const next = current === "present" ? "absent" : "present";

    try {
      const res = await fetch(`/api/staff/${staffId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, status: next }),
      });
      if (res.ok) {
        fetchMonthData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed", "error");
      }
    } catch {
      toast("Failed to update attendance", "error");
    }
  }

  /* ── Add advance ── */
  async function handleAddAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!advAmount || Number(advAmount) <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    setAdvSaving(true);
    try {
      const res = await fetch(`/api/staff/${staffId}/advances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(advAmount), date: advDate, note: advNote.trim() || null }),
      });
      if (res.ok) {
        toast("Advance added", "success");
        setShowAdvForm(false);
        setAdvAmount("");
        setAdvNote("");
        fetchMonthData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed", "error");
      }
    } catch {
      toast("Failed to add advance", "error");
    } finally {
      setAdvSaving(false);
    }
  }

  /* ── Delete advance ── */
  async function confirmDeleteAdvance() {
    if (!deleteAdvId) return;
    try {
      const res = await fetch(`/api/staff/${staffId}/advances?advanceId=${deleteAdvId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Advance deleted", "success");
        setDeleteAdvId(null);
        fetchMonthData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed", "error");
      }
    } catch {
      toast("Failed to delete", "error");
    }
  }

  /* ── Calendar grid ── */
  function renderCalendar() {
    const [y, m] = month.split("-").map(Number);
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0-6
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: JSX.Element[] = [];

    // Empty cells for days before 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(y, m - 1, day);
      const isFuture = dateObj > today;
      const status = attendanceMap.get(day);

      cells.push(
        <button
          key={day}
          onClick={() => !isFuture && toggleDay(day)}
          disabled={isFuture || locked}
          className={`relative aspect-square rounded-lg text-sm font-medium flex flex-col items-center justify-center gap-0.5 transition-all border ${
            isFuture
              ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
              : status === "present"
              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer"
              : status === "absent"
              ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 cursor-pointer"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100 cursor-pointer"
          }`}
          title={status ? status : "Not marked"}
        >
          <span>{day}</span>
          {status === "present" && <CheckCircle className="w-3 h-3 text-green-500" />}
          {status === "absent" && <XCircle className="w-3 h-3 text-red-500" />}
        </button>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-gray-400 uppercase py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{cells}</div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  const presentCount = salaryRow?.presentDays ?? 0;
  const absentCount = salaryRow?.absentDays ?? 0;

  return (
    <>
      <PageHeader
        title={staff.name}
        description={`${ROLE_LABELS[staff.role] || staff.role} • Base Salary: ${fmtRs(staff.baseSalary || 0)}`}
        action={
          <Link
            href="/dashboard/staff"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Staff List
          </Link>
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
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">{getMonthLabel(month)}</span>
          </div>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {locked && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
            🔒 Month Locked
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Calendar + Salary Summary ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Salary KPI Cards */}
            {salaryRow && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Banknote className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-500">Per Day Wage</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900">{fmtRs(salaryRow.perDayWage)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Base: {fmtRs(salaryRow.baseSalary)}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                      <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-500">Paid Days</span>
                  </div>
                  <div className="text-lg font-bold text-green-600">{salaryRow.paidDays}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">P: {salaryRow.presentDays} + PL: {salaryRow.paidLeaves}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Banknote className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-500">Salary</span>
                  </div>
                  <div className="text-lg font-bold text-blue-600">{fmtRs(salaryRow.salary)}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-500">Final Salary</span>
                  </div>
                  <div className={`text-lg font-bold ${salaryRow.finalSalary > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmtRs(salaryRow.finalSalary)}
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Calendar */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Attendance Calendar</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" /> Present: {presentCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500" /> Absent: {absentCount}
                  </span>
                  <span className="text-gray-400">
                    Unmarked: {daysInMonth - presentCount - absentCount}
                  </span>
                </div>
              </div>
              {renderCalendar()}
              <p className="text-[10px] text-gray-400 mt-3">Click a day to toggle present/absent</p>
            </div>

            {/* Salary Breakdown Table */}
            {salaryRow && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-900 px-5 py-3 border-b border-gray-200">
                  Salary Breakdown — {getMonthLabel(month)}
                </h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-5 py-2.5 text-gray-600">Per Day Wage</td>
                      <td className="px-5 py-2.5 text-right font-medium text-gray-900">{fmtRs(salaryRow.perDayWage)}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-2.5 text-gray-600">Present Days</td>
                      <td className="px-5 py-2.5 text-right font-medium text-green-600">{salaryRow.presentDays}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-2.5 text-gray-600">Absent Days</td>
                      <td className="px-5 py-2.5 text-right font-medium text-red-600">{salaryRow.absentDays}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-2.5 text-gray-600">
                        Paid Leaves
                        {salaryRow.paidLeaves === 0 && salaryRow.presentDays < 15 && (
                          <span className="text-[10px] text-orange-500 ml-1">(need ≥ 15 present)</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-blue-600">{salaryRow.paidLeaves}</td>
                    </tr>
                    <tr className="bg-indigo-50/30">
                      <td className="px-5 py-2.5 text-indigo-700">Paid Days ({salaryRow.presentDays} + {salaryRow.paidLeaves} PL)</td>
                      <td className="px-5 py-2.5 text-right font-medium text-indigo-700">{salaryRow.paidDays}</td>
                    </tr>
                    <tr className="bg-blue-50/30">
                      <td className="px-5 py-2.5 text-blue-700">Salary ({salaryRow.paidDays} × {fmtRs(salaryRow.perDayWage)})</td>
                      <td className="px-5 py-2.5 text-right font-medium text-blue-700">{fmtRs(salaryRow.salary)}</td>
                    </tr>
                    <tr className="bg-green-50/30">
                      <td className="px-5 py-2.5 text-green-700">(+) Bonus</td>
                      <td className="px-5 py-2.5 text-right font-medium text-green-700">{fmtRs(salaryRow.bonus)}</td>
                    </tr>
                    <tr className="bg-red-50/30">
                      <td className="px-5 py-2.5 text-red-600">(−) Advances</td>
                      <td className="px-5 py-2.5 text-right font-medium text-red-600">{fmtRs(salaryRow.advances)}</td>
                    </tr>
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-5 py-3 text-gray-900">= Final Salary</td>
                      <td className={`px-5 py-3 text-right text-lg ${salaryRow.finalSalary > 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {fmtRs(salaryRow.finalSalary)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Right: Advances Panel ── */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Advances</h3>
                {!locked && (
                  <button
                    onClick={() => setShowAdvForm((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                )}
              </div>

              {/* Add Advance Form */}
              {showAdvForm && !locked && (
                <form onSubmit={handleAddAdvance} className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
                    <input
                      type="number"
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="e.g. 5000"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={advDate}
                      onChange={(e) => setAdvDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                    <input
                      type="text"
                      value={advNote}
                      onChange={(e) => setAdvNote(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Optional note"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={advSaving}
                      className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {advSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdvForm(false)}
                      className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Advance List */}
              <div className="max-h-[400px] overflow-y-auto">
                {advances.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No advances this month</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {advances.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{fmtRs(a.amount)}</div>
                          <div className="text-xs text-gray-400">
                            {formatDate(a.date)}
                            {a.note && <span className="ml-2 text-gray-500">• {a.note}</span>}
                          </div>
                        </div>
                        {!locked && (
                          <button
                            onClick={() => setDeleteAdvId(a.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Advance Total */}
              {advances.length > 0 && (
                <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-200 flex justify-between text-sm font-medium">
                  <span className="text-gray-600">Total</span>
                  <span className="text-red-600">{fmtRs(advances.reduce((s, a) => s + Number(a.amount), 0))}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteAdvId !== null}
        title="Delete Advance"
        message="Are you sure you want to delete this advance?"
        confirmLabel="Delete"
        onConfirm={confirmDeleteAdvance}
        onCancel={() => setDeleteAdvId(null)}
      />
    </>
  );
}
