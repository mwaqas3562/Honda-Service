"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
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
  sales: { totalRevenue: number; recentRevenue: number; count: number; recentCount: number };
  purchases: { totalCost: number; recentCost: number; count: number; recentCount: number };
  services: { totalRevenue: number; recentRevenue: number; count: number; recentCount: number };
  dailyData: { date: string; sales: number; purchases: number; services: number }[];
  stockMovement: { stockIn: number; stockOut: number };
  categoryBreakdown: { name: string; partsCount: number; totalValue: number }[];
  grossProfit: number;
}

const CHART_COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reports");
        if (res.ok) setData(await res.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

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

  const kpiCards = [
    { label: "Inventory Value", value: fmtRs(data.inventory.totalInventoryValue), icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Sales (30d)", value: fmtRs(data.sales.recentRevenue), sub: `${data.sales.recentCount} orders`, icon: ShoppingCart, color: "text-green-600", bg: "bg-green-50" },
    { label: "Purchases (30d)", value: fmtRs(data.purchases.recentCost), sub: `${data.purchases.recentCount} orders`, icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Services (30d)", value: fmtRs(data.services.recentRevenue), sub: `${data.services.recentCount} jobs`, icon: Wrench, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Gross Profit (30d)", value: fmtRs(data.grossProfit), icon: data.grossProfit >= 0 ? TrendingUp : TrendingDown, color: data.grossProfit >= 0 ? "text-green-600" : "text-red-600", bg: data.grossProfit >= 0 ? "bg-green-50" : "bg-red-50" },
    { label: "Low Stock Alerts", value: `${data.inventory.lowStockParts + data.inventory.outOfStockParts}`, sub: `${data.inventory.outOfStockParts} out of stock`, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
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
      <PageHeader title="Reports & Analytics" description="Business insights and analytics (last 30 days)" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
            <div className={`${card.bg} p-3 rounded-lg`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">{card.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
              {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue & Expenses Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue & Expenses (Last 30 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartDaily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
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
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Stock Movement (30 Days)</h3>
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
          <h3 className="text-sm font-semibold text-gray-900">All-Time Summary</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Metric</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">All-Time</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Last 30 Days</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="px-6 py-3 text-sm text-gray-600">Sales Revenue</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{fmtRs(data.sales.totalRevenue)}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{fmtRs(data.sales.recentRevenue)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-6 py-3 text-sm text-gray-600">Service Revenue</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{fmtRs(data.services.totalRevenue)}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{fmtRs(data.services.recentRevenue)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-6 py-3 text-sm text-gray-600">Purchase Costs</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{fmtRs(data.purchases.totalCost)}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{fmtRs(data.purchases.recentCost)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-6 py-3 text-sm text-gray-600">Total Parts</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{data.inventory.totalParts}</td>
              <td className="px-6 py-3 text-sm text-gray-500">—</td>
            </tr>
            <tr>
              <td className="px-6 py-3 text-sm text-gray-600">Total Stock Units</td>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">{data.inventory.totalStockUnits.toLocaleString()}</td>
              <td className="px-6 py-3 text-sm text-gray-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
