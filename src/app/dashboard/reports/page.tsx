"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RefreshCw,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  Wrench,
  Truck,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Download,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { parseDateParams } from "@/lib/report-filters";
import { fmtRs } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface ReportData {
  inventory: {
    totalParts: number;
    totalStockUnits: number;
    totalInventoryValue: number;
    lowStockParts: number;
    outOfStockParts: number;
    topPartsByValue: { name: string; value: number; stock: number }[];
  };
  sales: { totalRevenue: number; periodRevenue: number; count: number; periodCount: number };
  purchases: { totalCost: number; periodCost: number; count: number; periodCount: number };
  services: { totalRevenue: number; periodRevenue: number; count: number; periodCount: number };
  dailyData: { date: string; sales: number; purchases: number; services: number }[];
  stockMovement: { stockIn: number; stockOut: number };
  categoryBreakdown: { name: string; partsCount: number; totalValue: number }[];
  grossProfit: number;
  period: { from: string; to: string; days: number };
}

type Preset = "today" | "7d" | "30d" | "90d" | "this-month" | "this-year" | "custom";

const CHART_COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

function getPresetDates(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const toStr = now.toISOString().slice(0, 10);
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().slice(0, 10);

  switch (preset) {
    case "today":
      return { from: toStr, to: toStr };
    case "7d":
      return { from: daysAgo(6), to: toStr };
    case "30d":
      return { from: daysAgo(29), to: toStr };
    case "90d":
      return { from: daysAgo(89), to: toStr };
    case "this-month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { from: firstDay, to: toStr };
    }
    case "this-year": {
      const jan1 = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      return { from: jan1, to: toStr };
    }
    default:
      return { from: daysAgo(29), to: toStr };
  }
}

const PRESET_LABELS: Record<Preset, string> = {
  today: "Today",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  "this-month": "This Month",
  "this-year": "This Year",
  custom: "Custom Range",
};

export default function ReportsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const urlDates = parseDateParams(sp);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>(urlDates.fromUrl ? "custom" : "30d");
  const [customFrom, setCustomFrom] = useState(urlDates.fromUrl ? urlDates.from : "");
  const [customTo, setCustomTo] = useState(urlDates.fromUrl ? urlDates.to : "");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const dates = preset === "custom" ? { from: customFrom, to: customTo } : getPresetDates(preset);
      if (!dates.from || !dates.to) return;
      const res = await fetch(`/api/reports?from=${dates.from}&to=${dates.to}`);
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    if (preset === "custom" && (!customFrom || !customTo)) return;
    fetchReports();
  }, [fetchReports, preset, customFrom, customTo]);



  const periodLabel = preset === "custom"
    ? `${customFrom} to ${customTo}`
    : PRESET_LABELS[preset];

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Period Value", "All-Time Value"],
      ["Sales Revenue", Math.round(data.sales.periodRevenue), Math.round(data.sales.totalRevenue)],
      ["Sales Count", data.sales.periodCount, data.sales.count],
      ["Service Revenue", Math.round(data.services.periodRevenue), Math.round(data.services.totalRevenue)],
      ["Service Count", data.services.periodCount, data.services.count],
      ["Purchase Costs", Math.round(data.purchases.periodCost), Math.round(data.purchases.totalCost)],
      ["Purchase Count", data.purchases.periodCount, data.purchases.count],
      ["Gross Profit", Math.round(data.grossProfit), ""],
      ["Stock In (units)", data.stockMovement.stockIn, ""],
      ["Stock Out (units)", data.stockMovement.stockOut, ""],
      [],
      ["Date", "Sales", "Purchases", "Services"],
      ...data.dailyData.map((d) => [d.date, Math.round(d.sales), Math.round(d.purchases), Math.round(d.services)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${data.period.from}-to-${data.period.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Reports & Analytics" description="Business insights and analytics" />
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Reports & Analytics" description="Business insights and analytics" />
        <p className="text-center text-gray-500 py-12">Failed to load reports</p>
      </>
    );
  }

  const dates = preset === "custom" ? { from: customFrom, to: customTo } : getPresetDates(preset);
  const txUrl = (type?: string) => {
    const p = new URLSearchParams({ from: dates.from, to: dates.to });
    if (type) p.set("type", type);
    return `/dashboard/reports/transactions?${p}`;
  };

  const kpiCards = [
    { label: "Inventory Value", value: fmtRs(data.inventory.totalInventoryValue), icon: Package, color: "text-blue-600", bg: "bg-blue-50", href: "/dashboard/reports/inventory" },
    { label: `Sales (${periodLabel})`, value: fmtRs(data.sales.periodRevenue), sub: `${data.sales.periodCount} orders`, icon: ShoppingCart, color: "text-green-600", bg: "bg-green-50", href: txUrl("sale") },
    { label: `Purchases (${periodLabel})`, value: fmtRs(data.purchases.periodCost), sub: `${data.purchases.periodCount} orders`, icon: Truck, color: "text-orange-600", bg: "bg-orange-50", href: txUrl("purchase") },
    { label: `Services (${periodLabel})`, value: fmtRs(data.services.periodRevenue), sub: `${data.services.periodCount} jobs`, icon: Wrench, color: "text-purple-600", bg: "bg-purple-50", href: txUrl("service") },
    { label: `Gross Profit (${periodLabel})`, value: fmtRs(data.grossProfit), icon: data.grossProfit >= 0 ? TrendingUp : TrendingDown, color: data.grossProfit >= 0 ? "text-green-600" : "text-red-600", bg: data.grossProfit >= 0 ? "bg-green-50" : "bg-red-50", href: txUrl() },
    { label: "Low Stock Alerts", value: `${data.inventory.lowStockParts + data.inventory.outOfStockParts}`, sub: `${data.inventory.outOfStockParts} out of stock`, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", href: "/dashboard/reports/inventory?stockFilter=low" },
  ];

  const stockMovementPie = [
    { name: "Stock In", value: data.stockMovement.stockIn },
    { name: "Stock Out", value: data.stockMovement.stockOut },
  ];

  // Format daily data for chart (show day/mon)
  const chartDaily = data.dailyData.map((d) => {
    const dt = new Date(d.date);
    return { ...d, label: `${dt.getDate()}/${dt.getMonth() + 1}` };
  });

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Business insights and analytics"
        action={
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        }
      />

      {/* Date Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["today", "7d", "30d", "90d", "this-month", "this-year", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPreset(p);
                  if (p !== "custom") { setCustomFrom(""); setCustomTo(""); }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  preset === p
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
          )}
          {loading && <RefreshCw className="w-4 h-4 text-gray-300 animate-spin ml-auto" />}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            onClick={() => router.push(card.href)}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group"
          >
            <div className={`${card.bg} p-3 rounded-lg`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-medium">{card.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1 group-hover:text-red-600 transition-colors">{card.value}</p>
              {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue & Expenses Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue & Expenses ({periodLabel})</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartDaily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(chartDaily.length / 8) - 1)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => fmtRs(Number(value))} />
            <Area type="monotone" dataKey="sales" name="Sales" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="services" name="Services" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#f97316" fill="#f97316" fillOpacity={0.1} strokeWidth={2} />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Parts by Inventory Value */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Parts by Inventory Value</h3>
          {data.inventory.topPartsByValue.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No inventory data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.inventory.topPartsByValue.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(value) => fmtRs(Number(value))} />
                <Bar dataKey="value" name="Value" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stock Movement Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Stock Movement ({periodLabel})</h3>
          {data.stockMovement.stockIn === 0 && data.stockMovement.stockOut === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No stock movement</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stockMovementPie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label>
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-8 mt-2">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">In: {data.stockMovement.stockIn} units</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-600">Out: {data.stockMovement.stockOut} units</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Inventory by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => fmtRs(Number(value))} />
              <Bar dataKey="totalValue" name="Value" radius={[4, 4, 0, 0]}>
                {data.categoryBreakdown.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Metric</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">All-Time</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">{periodLabel}</th>
            </tr>
          </thead>
          <tbody>
            <tr onClick={() => router.push(txUrl("sale"))} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3 text-sm text-gray-600">Sales Revenue</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{fmtRs(data.sales.totalRevenue)}</td>
              <td className="px-6 py-3 text-sm text-red-600 hover:underline">{fmtRs(data.sales.periodRevenue)}</td>
            </tr>
            <tr onClick={() => router.push(txUrl("service"))} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3 text-sm text-gray-600">Service Revenue</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{fmtRs(data.services.totalRevenue)}</td>
              <td className="px-6 py-3 text-sm text-red-600 hover:underline">{fmtRs(data.services.periodRevenue)}</td>
            </tr>
            <tr onClick={() => router.push(txUrl("purchase"))} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3 text-sm text-gray-600">Purchase Costs</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{fmtRs(data.purchases.totalCost)}</td>
              <td className="px-6 py-3 text-sm text-red-600 hover:underline">{fmtRs(data.purchases.periodCost)}</td>
            </tr>
            <tr onClick={() => router.push("/dashboard/reports/inventory")} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3 text-sm text-gray-600">Total Parts</td>
              <td className="px-6 py-3 text-sm font-semibold text-red-600 hover:underline">{data.inventory.totalParts}</td>
              <td className="px-6 py-3 text-sm text-gray-500">—</td>
            </tr>
            <tr onClick={() => router.push("/dashboard/reports/inventory")} className="cursor-pointer hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3 text-sm text-gray-600">Total Stock Units</td>
              <td className="px-6 py-3 text-sm font-semibold text-red-600 hover:underline">{data.inventory.totalStockUnits.toLocaleString()}</td>
              <td className="px-6 py-3 text-sm text-gray-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
