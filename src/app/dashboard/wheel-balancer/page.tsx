"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Target, DollarSign, Hash, Trophy, Settings, Check, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import IntegerInput from "@/components/IntegerInput";
import { fmtRs } from "@/lib/utils";

interface WBConfig {
  id: number;
  bonusThreshold: number;
  bonusType: string;
  bonusValue: number;
  active: boolean;
}

interface MonthlyPerf {
  month: string;
  serviceCount: number;
  totalEarnings: number;
  bonusAmount: number;
}

interface PerfData {
  staff: { id: number; name: string };
  config: WBConfig | null;
  currentMonth: { month: string; serviceCount: number; totalEarnings: number; bonusAmount: number };
  totals: { serviceCount: number; totalEarnings: number; totalBonus: number };
  monthly: MonthlyPerf[];
}

export default function WheelBalancerPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noStaff, setNoStaff] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));

  // Config modal
  const [showConfig, setShowConfig] = useState(false);
  const [cfgThreshold, setCfgThreshold] = useState("100");
  const [cfgType, setCfgType] = useState("flat");
  const [cfgValue, setCfgValue] = useState("0");
  const [cfgActive, setCfgActive] = useState(true);
  const [cfgSaving, setCfgSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (monthFilter) params.set("month", monthFilter);
      const res = await fetch(`/api/wheel-balancer/performance?${params.toString()}`);
      if (res.status === 404) { setNoStaff(true); return; }
      if (res.ok) {
        setNoStaff(false);
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch WB performance:", err);
    } finally {
      setLoading(false);
    }
  }, [monthFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openConfig = () => {
    if (data?.config) {
      setCfgThreshold(String(data.config.bonusThreshold));
      setCfgType(data.config.bonusType);
      setCfgValue(String(data.config.bonusValue));
      setCfgActive(data.config.active);
    } else {
      setCfgThreshold("100");
      setCfgType("flat");
      setCfgValue("0");
      setCfgActive(true);
    }
    setShowConfig(true);
  };

  const saveConfig = async () => {
    setCfgSaving(true);
    try {
      const res = await fetch("/api/wheel-balancer/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bonusThreshold: Number(cfgThreshold),
          bonusType: cfgType,
          bonusValue: Number(cfgValue),
          active: cfgActive,
        }),
      });
      if (res.ok) {
        toast("Bonus config saved", "success");
        setShowConfig(false);
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save", "error");
      }
    } catch {
      toast("Failed to save config", "error");
    } finally {
      setCfgSaving(false);
    }
  };


  const fmtMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const d = new Date(Number(y), Number(mo) - 1);
    return d.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
  };

  const threshold = data?.config?.bonusThreshold ?? 100;
  const currentCount = data?.currentMonth?.serviceCount ?? 0;
  const progressPct = Math.min(100, Math.round((currentCount / threshold) * 100));
  const progressColor =
    currentCount >= threshold ? "bg-green-500" : currentCount >= threshold * 0.7 ? "bg-yellow-500" : "bg-red-500";
  const progressLabel =
    currentCount >= threshold ? "Bonus Achieved!" : currentCount >= threshold * 0.7 ? "Almost There!" : "In Progress";

  // Generate last 12 months for filter
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500";

  if (loading) {
    return (
      <>
        <PageHeader title="Wheel Balancer Reports" description="Track wheel balancing performance and bonus" />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      </>
    );
  }

  if (noStaff) {
    return (
      <>
        <PageHeader title="Wheel Balancer Reports" description="Track wheel balancing performance and bonus" />
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No Active Wheel Balancer Staff</p>
          <p className="text-sm text-gray-400 mt-1">Add a staff member with the &quot;Wheel Balancer&quot; role in Staff Management</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Wheel Balancer Reports"
        description={`Performance tracking for ${data?.staff.name || "Wheel Balancer"}`}
        action={
          <button onClick={openConfig} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
            <Settings className="w-4 h-4" /> Bonus Config
          </button>
        }
      />

      {/* Month Filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-gray-600">Month:</label>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
        >
          {months.map((m) => (
            <option key={m} value={m}>{fmtMonth(m)}</option>
          ))}
        </select>
      </div>

      {/* Progress Bar Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Wheel Balancing Bonus Progress</h3>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            currentCount >= threshold
              ? "bg-green-100 text-green-700"
              : currentCount >= threshold * 0.7
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {progressLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-5 mb-2 relative overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${progressPct}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
            {currentCount} / {threshold} services
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{fmtMonth(data?.currentMonth?.month || monthFilter)}</span>
          <span>
            {data?.config?.active
              ? `Bonus: ${data.config.bonusType === "percentage" ? `${data.config.bonusValue}% of earnings` : fmtRs(data.config.bonusValue)}`
              : "No bonus configured"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-teal-500" />
            <p className="text-xs text-gray-500 uppercase">Services This Month</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data?.currentMonth?.serviceCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-teal-500" />
            <p className="text-xs text-gray-500 uppercase">Earnings This Month</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmtRs(data?.currentMonth?.totalEarnings ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500 uppercase">Bonus This Month</p>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-1">{fmtRs(data?.currentMonth?.bonusAmount ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500 uppercase">All-Time Earnings</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmtRs(data?.totals?.totalEarnings ?? 0)}</p>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-900">Monthly Breakdown</h3>
        </div>

        {!data?.monthly?.length ? (
          <div className="text-center py-12">
            <Target className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No performance data for this period</p>
            <p className="text-xs text-gray-300 mt-1">Data is tracked automatically when sales include Wheel Balancing labour</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Month</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Services</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Earnings</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Progress</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.monthly.map((m) => {
                  const pct = Math.min(100, Math.round((m.serviceCount / threshold) * 100));
                  const color = m.serviceCount >= threshold ? "bg-green-500" : m.serviceCount >= threshold * 0.7 ? "bg-yellow-500" : "bg-gray-300";
                  return (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{fmtMonth(m.month)}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{m.serviceCount}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{fmtRs(m.totalEarnings)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-14 text-right">{m.serviceCount}/{threshold}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${m.bonusAmount > 0 ? "text-amber-700" : "text-gray-300"}`}>
                          {m.bonusAmount > 0 ? fmtRs(m.bonusAmount) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config Modal */}
      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="Wheel Balancer Bonus Config">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Configure bonus rules for the Wheel Balancer. Bonus is calculated when monthly service count reaches the threshold.
          </p>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Service Count Threshold <span className="text-red-500">*</span>
            </label>
            <IntegerInput
              value={cfgThreshold}
              onChange={setCfgThreshold}
              className={inputClass}
              placeholder="100"
            />
            <p className="text-xs text-gray-400 mt-1">Minimum services per month to qualify for bonus</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Bonus Type
            </label>
            <select value={cfgType} onChange={(e) => setCfgType(e.target.value)} className={`${inputClass} bg-white cursor-pointer`}>
              <option value="flat">Flat Amount</option>
              <option value="percentage">Percentage of Earnings</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Bonus Value <span className="text-red-500">*</span>
            </label>
            <IntegerInput
              value={cfgValue}
              onChange={setCfgValue}
              className={inputClass}
              placeholder={cfgType === "percentage" ? "e.g. 5" : "e.g. 2000"}
            />
            <p className="text-xs text-gray-400 mt-1">
              {cfgType === "percentage" ? "% of total wheel balancing earnings" : "Fixed Rs amount after threshold"}
            </p>
          </div>

          {cfgThreshold && cfgValue && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
              <strong>Preview:</strong> After {cfgThreshold} services/month →{" "}
              <span className="font-bold text-amber-700">
                {cfgType === "percentage" ? `${cfgValue}% of earnings` : `Rs ${Number(cfgValue).toLocaleString()}`}
              </span>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfgActive}
              onChange={(e) => setCfgActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button onClick={() => setShowConfig(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={saveConfig} disabled={cfgSaving} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {cfgSaving ? "Saving..." : "Save Config"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
