"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send,
  Eye,
  RefreshCw,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Phone,
  AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

/* ─── Types ───────────────────────────────── */

interface EligibleCustomer {
  customerPhone: string;
  customerName: string;
  bikeNumber: string;
  bikeModel: string;
  messageType: string;
  priority: number;
  messagePreview: string;
}

interface LogEntry {
  id: number;
  customerPhone: string;
  customerName: string;
  bikeNumber: string | null;
  bikeModel: string | null;
  messageType: string;
  channel: string;
  status: string;
  priority: number;
  messageContent: string;
  twilioSid: string | null;
  errorMessage: string | null;
  sentAt: string;
}

interface Stats {
  sentToday: number;
  failedToday: number;
  totalThisMonth: number;
}

interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

/* ─── Helpers ─────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  engine_tuning: "Engine Tuning",
  oil_change: "Oil Change",
  missed_visit: "Missed Visit",
  comeback: "Comeback",
};

const TYPE_COLORS: Record<string, string> = {
  engine_tuning: "bg-blue-100 text-blue-700",
  oil_change: "bg-amber-100 text-amber-700",
  missed_visit: "bg-orange-100 text-orange-700",
  comeback: "bg-purple-100 text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  delivered: "bg-emerald-100 text-emerald-700",
  read: "bg-teal-100 text-teal-700",
  failed: "bg-red-100 text-red-700",
  ignored: "bg-gray-100 text-gray-500",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Component ───────────────────────────── */

export default function RemindersPage() {
  // View state
  const [view, setView] = useState<"logs" | "eligible">("logs");

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ sentToday: 0, failedToday: 0, totalThisMonth: 0 });
  const [logsPage, setLogsPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  // Eligible state
  const [eligible, setEligible] = useState<EligibleCustomer[]>([]);
  const [eligibleTotal, setEligibleTotal] = useState(0);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [eligibleLoading, setEligibleLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Actions
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const { toast } = useToast();

  // ─── Fetch logs ────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(logsPage), limit: "50" });
      if (search) params.set("search", search);
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/reminders/logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setLogs(data.logs);
      setStats(data.stats);
      setTotalPages(data.pagination.totalPages);
    } catch {
      toast("Failed to load reminder logs", "error");
    } finally {
      setLogsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsPage, search, filterType, filterStatus, dateFrom, dateTo]);

  // ─── Fetch eligible ───────────────────────
  const fetchEligible = useCallback(async () => {
    setEligibleLoading(true);
    try {
      const res = await fetch("/api/reminders/eligible");
      if (!res.ok) throw new Error("Failed to fetch eligible");
      const data = await res.json();
      setEligible(data.eligible);
      setEligibleTotal(data.total);
      setTotalProfiles(data.totalProfiles);
    } catch {
      toast("Failed to load eligible customers", "error");
    } finally {
      setEligibleLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Send reminders ──────────────────────
  const handleSend = async () => {
    setSending(true);
    setConfirmSend(false);
    try {
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Send failed");
      const data: SendResult = await res.json();
      toast(
        `Sent: ${data.sent}, Failed: ${data.failed}, Skipped: ${data.skipped}`,
        data.failed > 0 ? "error" : "success"
      );
      // Refresh both views
      fetchLogs();
      fetchEligible();
    } catch {
      toast("Failed to send reminders", "error");
    } finally {
      setSending(false);
    }
  };

  // Auto-fetch on mount and when filters change
  useEffect(() => {
    if (view === "logs") fetchLogs();
  }, [view, fetchLogs]);

  useEffect(() => {
    if (view === "eligible") fetchEligible();
  }, [view, fetchEligible]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Reminders"
        description="Send automated service reminders via WhatsApp & SMS"
      />

      {/* ─── Stats Cards ────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="Sent Today"
          value={stats.sentToday}
          color="bg-green-50"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          label="Failed Today"
          value={stats.failedToday}
          color="bg-red-50"
        />
        <StatCard
          icon={<MessageCircle className="w-5 h-5 text-blue-600" />}
          label="This Month"
          value={stats.totalThisMonth}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Eligible Now"
          value={eligibleTotal}
          color="bg-amber-50"
        />
      </div>

      {/* ─── Action Buttons ─────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setView(view === "eligible" ? "logs" : "eligible")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          <Eye className="w-4 h-4" />
          {view === "eligible" ? "View Logs" : "Preview Eligible"}
        </button>
        <button
          onClick={() => setConfirmSend(true)}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {sending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? "Sending..." : "Send Reminders Now"}
        </button>
        <button
          onClick={() => (view === "eligible" ? fetchEligible() : fetchLogs())}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ─── Eligible Preview ───────────────── */}
      {view === "eligible" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Eligible Customers ({eligibleTotal} of {totalProfiles} profiles)
            </h3>
            {eligibleLoading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
          </div>

          {eligible.length === 0 && !eligibleLoading ? (
            <div className="p-8 text-center text-gray-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No customers eligible for reminders right now
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Bike</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Message Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {eligible.map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.customerName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.customerPhone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.bikeModel || c.bikeNumber || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            TYPE_COLORS[c.messageType] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {TYPE_LABELS[c.messageType] || c.messageType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-xs font-bold">
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {c.messagePreview}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Logs View ──────────────────────── */}
      {view === "logs" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search name or phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setLogsPage(1); }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setLogsPage(1); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Types</option>
              <option value="engine_tuning">Engine Tuning</option>
              <option value="oil_change">Oil Change</option>
              <option value="missed_visit">Missed Visit</option>
              <option value="comeback">Comeback</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setLogsPage(1); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
              <option value="ignored">Ignored</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setLogsPage(1); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setLogsPage(1); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Logs table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {logsLoading ? (
              <div className="p-8 text-center text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No reminder logs yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Bike</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDate(log.sentAt)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {log.customerName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{log.customerPhone}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {log.bikeModel || log.bikeNumber || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              TYPE_COLORS[log.messageType] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {TYPE_LABELS[log.messageType] || log.messageType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              log.channel === "whatsapp"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {log.channel === "whatsapp" ? "WhatsApp" : "SMS"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_COLORS[log.status] || "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-500 text-xs max-w-[200px] truncate">
                          {log.errorMessage || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <button
                  disabled={logsPage <= 1}
                  onClick={() => setLogsPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {logsPage} of {totalPages}
                </span>
                <button
                  disabled={logsPage >= totalPages}
                  onClick={() => setLogsPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Confirm Dialog ─────────────────── */}
      <ConfirmDialog
        open={confirmSend}
        title="Send Reminders"
        message={`This will send WhatsApp/SMS reminders to all eligible customers. Continue?`}
        confirmLabel="Send Now"
        onConfirm={handleSend}
        onCancel={() => setConfirmSend(false)}
      />

    </div>
  );
}

/* ─── Stat Card ──────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`${color} rounded-xl p-4 flex items-center gap-3`}>
      {icon}
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-600">{label}</p>
      </div>
    </div>
  );
}
