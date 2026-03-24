"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Save,
  Users,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";

/* ─── Types ──────────────────────────────────── */

interface Staff {
  id: number;
  name: string;
  role: string;
  status: string;
}

interface AttendanceRecord {
  id: number;
  staffId: number;
  date: string;
  status: string;
}

type DayStatus = "present" | "absent" | null;

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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(date: string, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(date: string) {
  return new Date(date).toLocaleDateString("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ─── Component ──────────────────────────────── */

export default function DailyAttendancePage() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [staff, setStaff] = useState<Staff[]>([]);
  const [statuses, setStatuses] = useState<Map<number, DayStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  const isFuture = date > todayStr();

  // Fetch active staff + existing attendance for the date
  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const month = date.slice(0, 7);
      const [staffRes, attRes, lockRes] = await Promise.all([
        fetch("/api/staff?search=", { signal }),
        fetch(`/api/attendance?month=${month}`, { signal }),
        fetch(`/api/salary?month=${month}`, { signal }),
      ]);

      if (staffRes.ok) {
        const list: Staff[] = await staffRes.json();
        setStaff(list.filter((s) => s.status === "active"));
      }

      if (attRes.ok) {
        const records: AttendanceRecord[] = await attRes.json();
        const dayRecords = records.filter(
          (r) => new Date(r.date).toISOString().split("T")[0] === date
        );
        const map = new Map<number, DayStatus>();
        for (const r of dayRecords) {
          map.set(r.staffId, r.status as DayStatus);
        }
        setStatuses(map);
      }

      if (lockRes.ok) {
        const d = await lockRes.json();
        setLocked(d.locked);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const c = new AbortController();
    fetchData(c.signal);
    return () => c.abort();
  }, [fetchData]);

  function toggleStatus(staffId: number) {
    if (locked || isFuture) return;
    setStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(staffId);
      if (!current) next.set(staffId, "present");
      else if (current === "present") next.set(staffId, "absent");
      else next.set(staffId, "present");
      return next;
    });
  }

  function markAll(status: "present" | "absent") {
    if (locked || isFuture) return;
    setStatuses(() => {
      const m = new Map<number, DayStatus>();
      for (const s of staff) m.set(s.id, status);
      return m;
    });
  }

  async function handleSave() {
    if (locked) {
      toast("Month is locked", "error");
      return;
    }
    if (isFuture) {
      toast("Cannot mark future dates", "error");
      return;
    }
    const entries = staff
      .filter((s) => statuses.get(s.id))
      .map((s) => ({ staffId: s.id, status: statuses.get(s.id)! }));

    if (entries.length === 0) {
      toast("No attendance marked", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, entries }),
      });
      if (res.ok) {
        const data = await res.json();
        toast(`Saved attendance for ${data.saved} staff`, "success");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save", "error");
      }
    } catch {
      toast("Failed to save attendance", "error");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = staff.filter((s) => statuses.get(s.id) === "present").length;
  const absentCount = staff.filter((s) => statuses.get(s.id) === "absent").length;
  const unmarkedCount = staff.length - presentCount - absentCount;

  return (
    <>
      <PageHeader
        title="Daily Attendance"
        description="Mark attendance for all staff at once"
        action={
          <Link
            href="/dashboard/staff"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Staff
          </Link>
        }
      />

      {/* ── Date Selector ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayStr()}
              className="text-sm font-semibold text-gray-900 border-none outline-none bg-transparent"
            />
          </div>
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={isFuture}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500 ml-2">{formatDateLabel(date)}</span>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              🔒 Month Locked
            </span>
          )}
          {isFuture && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              Future date
            </span>
          )}
        </div>
      </div>

      {/* ── Summary Bar ── */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="flex items-center gap-1.5 text-gray-600">
          <Users className="w-4 h-4" /> {staff.length} staff
        </span>
        <span className="flex items-center gap-1.5 text-green-600 font-medium">
          <CheckCircle className="w-4 h-4" /> {presentCount} present
        </span>
        <span className="flex items-center gap-1.5 text-red-600 font-medium">
          <XCircle className="w-4 h-4" /> {absentCount} absent
        </span>
        {unmarkedCount > 0 && (
          <span className="text-gray-400">{unmarkedCount} unmarked</span>
        )}
        <div className="flex-1" />
        {!locked && !isFuture && (
          <>
            <button
              onClick={() => markAll("present")}
              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              All Present
            </button>
            <button
              onClick={() => markAll("absent")}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              All Absent
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        )}
      </div>

      {/* ── Staff Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active staff</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {staff.map((s) => {
            const st = statuses.get(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleStatus(s.id)}
                disabled={locked || isFuture}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  st === "present"
                    ? "bg-green-50 border-green-300 hover:border-green-400"
                    : st === "absent"
                    ? "bg-red-50 border-red-300 hover:border-red-400"
                    : "bg-white border-gray-200 hover:border-gray-300"
                } ${locked || isFuture ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ROLE_COLORS[s.role] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {ROLE_LABELS[s.role] || s.role}
                    </span>
                  </div>
                  <div className="flex-shrink-0">
                    {st === "present" && <CheckCircle className="w-7 h-7 text-green-500" />}
                    {st === "absent" && <XCircle className="w-7 h-7 text-red-500" />}
                    {!st && (
                      <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300" />
                    )}
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-medium uppercase tracking-wide">
                  {st === "present" ? (
                    <span className="text-green-600">Present</span>
                  ) : st === "absent" ? (
                    <span className="text-red-600">Absent</span>
                  ) : (
                    <span className="text-gray-400">Tap to mark</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Help text ── */}
      {!locked && !isFuture && staff.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-4 text-center">
          Click a card to toggle: unmarked → present → absent → present. Use &quot;All Present&quot; / &quot;All Absent&quot; for quick bulk marking, then Save.
        </p>
      )}
    </>
  );
}
