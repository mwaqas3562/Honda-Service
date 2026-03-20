"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Trophy, Search, Calendar, RefreshCw, Medal, DollarSign,
  FileText, Users, X, Download, Target, Wrench,
  ChevronDown, TrendingUp, Award,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { fmtRs } from "@/lib/utils";

// ─── Types ───────────────────────────────────────

interface BonusLog {
  id: number;
  staffId: number;
  jobCardId: number;
  jobCardAmount: number;
  bonusAmount: number;
  bonusType: string;
  bonusValue: number;
  createdAt: string;
  staff: { id: number; name: string; role: string };
  jobCard: { id: number; jobCardNumber: string; customerName: string; bikeModel: string };
}

interface LeaderboardEntry {
  id: number;
  name: string;
  role: string;
  totalBonus: number;
  bonusCount: number;
}

interface WBMonthly {
  month: string;
  serviceCount: number;
  totalEarnings: number;
  bonusAmount: number;
}

interface WBData {
  staff: { id: number; name: string } | null;
  serviceCount: number;
  totalEarnings: number;
  bonusAmount: number;
  monthly: WBMonthly[];
}

interface ReportData {
  leaderboard: LeaderboardEntry[];
  logs: BonusLog[];
  totalBonusPaid: number;
  totalBonusCount: number;
  jobCardBonus: { total: number; count: number };
  wheelBalancer: WBData;
  eligibleJobCards: number;
}

// ─── Constants ───────────────────────────────────

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
  admin: "bg-red-100 text-red-700",
};

const MEDAL_COLORS = ["text-yellow-500", "text-gray-400", "text-amber-600"];

const FILTERABLE_ROLES = [
  { value: "mechanic", label: "Mechanic" },
  { value: "wheel_balancer", label: "Wheel Balancer" },
  { value: "job_card_person", label: "Job Card Person" },
];

const BONUS_TYPES = [
  { value: "all", label: "All Types" },
  { value: "job_card", label: "Job Card Bonus" },
  { value: "wheel_balancer", label: "Wheel Balancer Bonus" },
];

type QuickFilter = "today" | "thisWeek" | "thisMonth" | "lastMonth" | "custom";

function getQuickDates(key: QuickFilter): { from: string; to: string } | null {
  if (key === "custom") return null;
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const from = new Date();

  switch (key) {
    case "today":
      break;
    case "thisWeek": {
      const day = from.getDay();
      from.setDate(from.getDate() - (day === 0 ? 6 : day - 1)); // Monday
      break;
    }
    case "thisMonth":
      from.setDate(1);
      break;
    case "lastMonth":
      from.setMonth(from.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: from.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
  }
  return { from: from.toISOString().split("T")[0], to };
}

// ─── Export helpers ──────────────────────────────

function exportCSV(data: ReportData) {
  const rows: string[][] = [];
  rows.push(["Type", "Staff", "Role", "Job Card", "Customer", "JC Amount", "Bonus", "Date"]);
  for (const log of data.logs) {
    rows.push([
      "Job Card Bonus",
      log.staff.name,
      ROLE_LABELS[log.staff.role] || log.staff.role,
      log.jobCard.jobCardNumber,
      log.jobCard.customerName,
      String(Math.round(log.jobCardAmount)),
      String(Math.round(log.bonusAmount)),
      new Date(log.createdAt).toLocaleDateString("en-PK"),
    ]);
  }
  if (data.wheelBalancer.staff && data.wheelBalancer.monthly.length > 0) {
    for (const m of data.wheelBalancer.monthly) {
      rows.push([
        "Wheel Balancer",
        data.wheelBalancer.staff.name,
        "Wheel Balancer",
        `${m.serviceCount} services`,
        "—",
        String(Math.round(m.totalEarnings)),
        String(Math.round(m.bonusAmount)),
        m.month,
      ]);
    }
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadFile(csv, "bonus-rewards-report.csv", "text/csv");
}

function exportPDF(data: ReportData) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bonus & Rewards Report</title>
<style>body{font-family:Arial,sans-serif;margin:30px;color:#333}h1{color:#dc2626;font-size:20px}
h2{font-size:16px;margin-top:24px;border-bottom:2px solid #eee;padding-bottom:6px}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th{background:#f9fafb;text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;text-transform:uppercase;font-size:10px;color:#6b7280}
td{padding:8px 12px;border-bottom:1px solid #f3f4f6}
.summary{display:flex;gap:20px;margin:16px 0}.summary div{background:#f9fafb;padding:12px 16px;border-radius:8px;min-width:140px}
.summary .label{font-size:10px;color:#6b7280;text-transform:uppercase}.summary .value{font-size:18px;font-weight:700;margin-top:4px}
.text-right{text-align:right}.text-center{text-align:center}.bold{font-weight:700}.amber{color:#b45309}
@media print{body{margin:10px}}</style></head><body>`;
  html += `<h1>Danish Honda Palace — Bonus & Rewards Report</h1>`;
  html += `<p style="color:#6b7280;font-size:12px">Generated: ${new Date().toLocaleString("en-PK")}</p>`;
  html += `<div class="summary">
<div><div class="label">Total Bonus Paid</div><div class="value">${fmtRs(data.totalBonusPaid)}</div></div>
<div><div class="label">Job Card Bonuses</div><div class="value">${data.jobCardBonus.count}</div></div>
<div><div class="label">WB Services</div><div class="value">${data.wheelBalancer.serviceCount}</div></div>
<div><div class="label">WB Bonus</div><div class="value">${fmtRs(data.wheelBalancer.bonusAmount)}</div></div>
</div>`;

  if (data.logs.length > 0) {
    html += `<h2>Job Card Bonus History</h2><table><thead><tr>
<th>Staff</th><th>Job Card</th><th>Customer</th><th class="text-right">JC Amount</th><th class="text-center">Rule</th><th class="text-right">Bonus</th><th>Date</th></tr></thead><tbody>`;
    for (const log of data.logs) {
      html += `<tr><td>${log.staff.name}</td><td>${log.jobCard.jobCardNumber}</td>
<td>${log.jobCard.customerName}</td><td class="text-right">${fmtRs(log.jobCardAmount)}</td>
<td class="text-center">${log.bonusValue}%</td><td class="text-right bold amber">${fmtRs(log.bonusAmount)}</td>
<td>${new Date(log.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  if (data.wheelBalancer.monthly.length > 0) {
    html += `<h2>Wheel Balancer Monthly Summary</h2><table><thead><tr>
<th>Month</th><th class="text-right">Services</th><th class="text-right">Earnings</th><th class="text-right">Bonus</th></tr></thead><tbody>`;
    for (const m of data.wheelBalancer.monthly) {
      html += `<tr><td>${m.month}</td><td class="text-right">${m.serviceCount}</td>
<td class="text-right">${fmtRs(m.totalEarnings)}</td><td class="text-right bold amber">${fmtRs(m.bonusAmount)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) {
    w.onload = () => {
      w.print();
      URL.revokeObjectURL(url);
    };
  }
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Component ───────────────────────────────────

export default function BonusRewardsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [bonusTypeFilter, setBonusTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Staff list
  const [allStaff, setAllStaff] = useState<{ id: number; name: string; role: string }[]>([]);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const staffDropdownRef = useRef<HTMLDivElement>(null);

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Fetch staff list
  useEffect(() => {
    fetch("/api/staff?status=active")
      .then((r) => r.json())
      .then((d) =>
        setAllStaff(
          Array.isArray(d)
            ? d.map((s: { id: number; name: string; role: string }) => ({ id: s.id, name: s.name, role: s.role }))
            : []
        )
      )
      .catch(() => {});
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(e.target as Node)) {
        setStaffDropdownOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (quickFilter === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      } else {
        const dates = getQuickDates(quickFilter);
        if (dates) {
          params.set("from", dates.from);
          params.set("to", dates.to);
        }
      }
      if (staffFilter) params.set("staffId", staffFilter);
      if (roleFilter) params.set("role", roleFilter);
      if (bonusTypeFilter !== "all") params.set("bonusType", bonusTypeFilter);

      const res = await fetch(`/api/bonus-reports?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to fetch bonus reports:", err);
    } finally {
      setLoading(false);
    }
  }, [quickFilter, customFrom, customTo, staffFilter, roleFilter, bonusTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Recalculate all bonuses
  const [recalculating, setRecalculating] = useState(false);
  const recalculateBonuses = useCallback(async () => {
    setRecalculating(true);
    try {
      const res = await fetch("/api/bonus-reports/recalculate", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Recalculate failed:", err);
    } finally {
      setRecalculating(false);
    }
  }, [fetchData]);

  // Filtered logs for table search
  const filteredLogs = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data.logs;
    const q = searchQuery.toLowerCase();
    return data.logs.filter(
      (log) =>
        log.staff.name.toLowerCase().includes(q) ||
        log.jobCard.jobCardNumber.includes(q) ||
        log.jobCard.customerName.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Filtered staff for searchable dropdown
  const filteredStaff = useMemo(() => {
    if (!staffSearch) return allStaff;
    const q = staffSearch.toLowerCase();
    return allStaff.filter((s) => s.name.toLowerCase().includes(q));
  }, [allStaff, staffSearch]);

  const selectedStaffName = allStaff.find((s) => String(s.id) === staffFilter)?.name;

  // Active filters
  const activeFilters: { label: string; onRemove: () => void }[] = [];
  if (staffFilter && selectedStaffName) {
    activeFilters.push({ label: `Staff: ${selectedStaffName}`, onRemove: () => setStaffFilter("") });
  }
  if (roleFilter) {
    activeFilters.push({
      label: `Role: ${ROLE_LABELS[roleFilter] || roleFilter}`,
      onRemove: () => setRoleFilter(""),
    });
  }
  if (bonusTypeFilter !== "all") {
    activeFilters.push({
      label: `Type: ${BONUS_TYPES.find((b) => b.value === bonusTypeFilter)?.label}`,
      onRemove: () => setBonusTypeFilter("all"),
    });
  }
  if (quickFilter === "custom" && (customFrom || customTo)) {
    activeFilters.push({
      label: `Date: ${customFrom || "..."} → ${customTo || "..."}`,
      onRemove: () => { setQuickFilter("thisMonth"); setCustomFrom(""); setCustomTo(""); },
    });
  }

  const hasFilters = staffFilter || roleFilter || bonusTypeFilter !== "all" || quickFilter === "custom";

  const clearAll = () => {
    setStaffFilter("");
    setRoleFilter("");
    setBonusTypeFilter("all");
    setQuickFilter("thisMonth");
    setCustomFrom("");
    setCustomTo("");
    setSearchQuery("");
  };


  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "thisWeek", label: "This Week" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
  ];

  return (
    <>
      <PageHeader
        title="Bonus & Rewards"
        description="Track staff bonuses from job cards and wheel balancing services"
      />

      {/* ─── Sticky Filter Bar ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 sticky top-0 z-20 shadow-sm space-y-3">
        {/* Row 1: Quick Date Filters + Export */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Period
          </span>
          {quickFilters.map((p) => (
            <button
              key={p.key}
              onClick={() => setQuickFilter(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                quickFilter === p.key
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setQuickFilter("custom")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              quickFilter === "custom"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            Custom Range
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Recalculate */}
          <button
            onClick={recalculateBonuses}
            disabled={recalculating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
            title="Recalculate bonuses for all completed job cards"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Recalculate"}
          </button>

          {/* Export */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              disabled={!data}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && data && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30 min-w-[140px]">
                <button
                  onClick={() => { exportCSV(data); setExportOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-green-600" /> Export CSV
                </button>
                <button
                  onClick={() => { exportPDF(data); setExportOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" /> Export PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Custom Dates + Staff + Role + Bonus Type */}
        <div className="flex flex-wrap items-end gap-3">
          {quickFilter === "custom" && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Start Date</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">End Date</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Staff dropdown (searchable) */}
          <div ref={staffDropdownRef} className="relative">
            <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" /> Staff
            </label>
            <button
              onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[170px] text-left"
            >
              <span className={staffFilter ? "text-gray-900" : "text-gray-400"}>
                {selectedStaffName || "All Staff"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
            </button>
            {staffDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 w-[220px]">
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="Search staff..."
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto py-1">
                  <button
                    onClick={() => { setStaffFilter(""); setStaffDropdownOpen(false); setStaffSearch(""); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${!staffFilter ? "text-red-600 font-medium" : "text-gray-700"}`}
                  >
                    All Staff
                  </button>
                  {filteredStaff.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setStaffFilter(String(s.id)); setStaffDropdownOpen(false); setStaffSearch(""); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between ${
                        String(s.id) === staffFilter ? "text-red-600 font-medium" : "text-gray-700"
                      }`}
                    >
                      <span>{s.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[s.role] || "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[s.role] || s.role}
                      </span>
                    </button>
                  ))}
                  {filteredStaff.length === 0 && (
                    <p className="text-xs text-gray-400 px-3 py-2">No staff found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Role filter */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer min-w-[150px]"
            >
              <option value="">All Roles</option>
              {FILTERABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Bonus type filter */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
              <Award className="w-3 h-3" /> Bonus Type
            </label>
            <select
              value={bonusTypeFilter}
              onChange={(e) => setBonusTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer min-w-[170px]"
            >
              {BONUS_TYPES.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200 self-end"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Active filter tags */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">Active:</span>
            {activeFilters.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full"
              >
                {f.label}
                <button
                  onClick={f.onRemove}
                  className="hover:bg-red-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400">Failed to load data</div>
      ) : (
        <>
          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KPICard
              icon={<DollarSign className="w-4 h-4 text-amber-500" />}
              label="Total Bonus Paid"
              value={fmtRs(data.totalBonusPaid)}
              accent="amber"
            />
            <KPICard
              icon={<FileText className="w-4 h-4 text-blue-500" />}
              label="Eligible Job Cards"
              value={String(data.eligibleJobCards)}
              accent="blue"
            />
            <KPICard
              icon={<Trophy className="w-4 h-4 text-purple-500" />}
              label="JC Bonus Total"
              value={fmtRs(data.jobCardBonus.total)}
              accent="purple"
            />
            <KPICard
              icon={<Target className="w-4 h-4 text-teal-500" />}
              label="WB Services"
              value={String(data.wheelBalancer.serviceCount)}
              accent="teal"
            />
            <KPICard
              icon={<TrendingUp className="w-4 h-4 text-green-500" />}
              label="WB Earnings"
              value={fmtRs(data.wheelBalancer.totalEarnings)}
              accent="green"
            />
            <KPICard
              icon={<Award className="w-4 h-4 text-red-500" />}
              label="WB Bonus"
              value={fmtRs(data.wheelBalancer.bonusAmount)}
              accent="red"
            />
          </div>

          {/* ─── Bonus Breakdown ─── */}
          {(data.jobCardBonus.total > 0 || data.wheelBalancer.bonusAmount > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" /> Bonus Breakdown by Type
              </h3>
              <div className="flex gap-3">
                {data.jobCardBonus.total > 0 && (
                  <div className="flex-1 bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-purple-700">Job Card Bonus</span>
                      <span className="text-xs font-bold text-purple-800">{fmtRs(data.jobCardBonus.total)}</span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${data.totalBonusPaid > 0 ? Math.round((data.jobCardBonus.total / data.totalBonusPaid) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-purple-500 mt-1">
                      {data.jobCardBonus.count} award{data.jobCardBonus.count !== 1 ? "s" : ""} •{" "}
                      {data.totalBonusPaid > 0 ? Math.round((data.jobCardBonus.total / data.totalBonusPaid) * 100) : 0}% of total
                    </p>
                  </div>
                )}
                {data.wheelBalancer.bonusAmount > 0 && (
                  <div className="flex-1 bg-teal-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-teal-700">Wheel Balancer Bonus</span>
                      <span className="text-xs font-bold text-teal-800">{fmtRs(data.wheelBalancer.bonusAmount)}</span>
                    </div>
                    <div className="w-full bg-teal-200 rounded-full h-2">
                      <div
                        className="bg-teal-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${data.totalBonusPaid > 0 ? Math.round((data.wheelBalancer.bonusAmount / data.totalBonusPaid) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-teal-500 mt-1">
                      {data.wheelBalancer.serviceCount} services • {data.wheelBalancer.monthly.filter((m) => m.bonusAmount > 0).length} month(s) •{" "}
                      {data.totalBonusPaid > 0 ? Math.round((data.wheelBalancer.bonusAmount / data.totalBonusPaid) * 100) : 0}% of total
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Leaderboard ─── */}
          {data.leaderboard.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {data.leaderboard.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 px-5 py-3 ${i === 0 ? "bg-amber-50/50" : ""}`}
                  >
                    <div className="w-8 text-center">
                      {i < 3 ? (
                        <Medal className={`w-5 h-5 mx-auto ${MEDAL_COLORS[i]}`} />
                      ) : (
                        <span className="text-sm font-medium text-gray-400">#{i + 1}</span>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-red-600">{entry.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{entry.name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[entry.role] || "bg-gray-100 text-gray-600"}`}>
                          {ROLE_LABELS[entry.role] || entry.role}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{entry.bonusCount} bonus{entry.bonusCount !== 1 ? "es" : ""}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-700">{fmtRs(entry.totalBonus)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── WB Monthly Breakdown (if wheel_balancer data) ─── */}
          {data.wheelBalancer.monthly.length > 0 && (bonusTypeFilter === "all" || bonusTypeFilter === "wheel_balancer") && (
            <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-teal-500" /> Wheel Balancer — Monthly Breakdown
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Month</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Services</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Earnings</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.wheelBalancer.monthly.map((m) => (
                      <tr key={m.month} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{m.month}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{m.serviceCount}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{fmtRs(m.totalEarnings)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold ${m.bonusAmount > 0 ? "text-amber-700" : "text-gray-400"}`}>
                            {m.bonusAmount > 0 ? fmtRs(m.bonusAmount) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── Bonus History Table ─── */}
          {(bonusTypeFilter === "all" || bonusTypeFilter === "job_card") && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">Job Card Bonus History</h3>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 w-48"
                  />
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="text-center py-16">
                  <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No job card bonus records for this period</p>
                  <p className="text-xs text-gray-300 mt-1">Bonuses are awarded when job cards are completed</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Staff</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Job Card</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Customer</th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">JC Amount</th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Rule</th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Bonus</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-red-600">{log.staff.name.charAt(0)}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">{log.staff.name}</span>
                                <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[log.staff.role] || "bg-gray-100 text-gray-600"}`}>
                                  {ROLE_LABELS[log.staff.role] || log.staff.role}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-mono text-red-600 font-medium">{log.jobCard.jobCardNumber}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{log.jobCard.customerName}</td>
                          <td className="px-5 py-3 text-right text-gray-700">{fmtRs(log.jobCardAmount)}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="text-xs text-gray-500">{log.bonusValue}%</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="font-bold text-amber-700">{fmtRs(log.bonusAmount)}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">
                            {new Date(log.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {filteredLogs.length > 0 && (
                <div className="px-5 py-2.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between">
                  <span>{filteredLogs.length} record(s)</span>
                  <span className="font-medium text-amber-700">
                    Total: {fmtRs(filteredLogs.reduce((s, l) => s + l.bonusAmount, 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── KPI Card Component ──────────────────────────

function KPICard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent: string;
}) {
  const borderColors: Record<string, string> = {
    amber: "border-l-amber-400",
    blue: "border-l-blue-400",
    purple: "border-l-purple-400",
    teal: "border-l-teal-400",
    green: "border-l-green-400",
    red: "border-l-red-400",
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColors[accent] || "border-l-gray-400"} px-4 py-3`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] text-gray-500 uppercase font-semibold truncate">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
    </div>
  );
}
