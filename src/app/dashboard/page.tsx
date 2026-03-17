"use client";

import { useState, useEffect } from "react";
import { Package, ShoppingCart, Wrench, DollarSign, AlertTriangle, TrendingUp, CalendarDays, FileText, Truck, ClipboardList, Lock, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface RecentSale {
  id: number;
  invoiceNumber: string;
  customer: string;
  jobCardNumber: string | null;
  bikeModel: string | null;
  vehicleNumber: string | null;
  total: number;
  status: string;
  date: string;
  itemCount: number;
  items: string;
}

interface RecentService {
  id: number;
  customer: string;
  bike: string;
  service: string;
  status: string;
  total: number;
  date: string;
}

interface DashboardStats {
  totalParts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValue: number;
  totalSalesRevenue: number;
  totalSalesCount: number;
  totalServicesRevenue: number;
  activeServicesCount: number;
  todayJobCardsCount: number;
  todayPurchasesCount: number;
  todayPurchasesAmount: number;
  todaySalesCount: number;
  todaySalesRevenue: number;
  todayDraftsCount: number;
  todayServicesCount: number;
  todayServicesRevenue: number;
  recentSales: RecentSale[];
  recentServices: RecentService[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<{ name: string; stock: number; minStock: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => r.json()),
      fetch("/api/parts/low-stock").then((r) => r.json()),
    ])
      .then(([s, ls]) => { setStats(s); setLowStock(ls); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
  const todayStr = new Date().toLocaleDateString("en-PK", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });

  const statusColor: Record<string, string> = {
    pending: "bg-red-100 text-red-700",
    in_progress: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
  };
  const statusLabel: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview of your Honda Bike Service & Spare Parts business" />
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your Honda Bike Service & Spare Parts business" />

      {/* ═══ TODAY'S SUMMARY ═══ */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <CalendarDays className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Today&apos;s Summary</h2>
            <p className="text-xs text-gray-400">{todayStr}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Job Cards Today */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Today</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{stats?.todayJobCardsCount ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Job Cards Created</p>
          </div>

          {/* Purchases Today */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{stats?.todayPurchasesCount ?? 0} orders</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{fmtRs(stats?.todayPurchasesAmount ?? 0)}</p>
            <p className="text-sm text-gray-500 mt-1">Purchases Today</p>
          </div>

          {/* Services Today */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{stats?.todayServicesCount ?? 0} jobs</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{fmtRs(stats?.todayServicesRevenue ?? 0)}</p>
            <p className="text-sm text-gray-500 mt-1">Services Today</p>
          </div>

          {/* Sales Today */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-[4rem] -mr-4 -mt-4 opacity-60" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{stats?.todaySalesCount ?? 0} finalized</span>
              </div>
              <p className="text-3xl font-extrabold text-green-700">{fmtRs(stats?.todaySalesRevenue ?? 0)}</p>
              <p className="text-sm text-gray-500 mt-1">Sales Revenue Today</p>
              {(stats?.todayDraftsCount ?? 0) > 0 && (
                <p className="text-xs text-amber-600 mt-1.5 font-medium">+ {stats!.todayDraftsCount} draft(s) pending</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ALL-TIME OVERVIEW ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Parts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalParts ?? "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{(stats?.totalStock ?? 0).toLocaleString()} units in stock</p>
            </div>
            <div className="w-11 h-11 bg-red-50 rounded-lg flex items-center justify-center">
              <Package className="w-5.5 h-5.5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Sales</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats ? fmtRs(stats.totalSalesRevenue) : "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stats?.totalSalesCount ?? 0} finalized invoices</p>
            </div>
            <div className="w-11 h-11 bg-green-50 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5.5 h-5.5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Services</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats?.activeServicesCount ?? "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stats ? fmtRs(stats.totalServicesRevenue) + " total" : ""}</p>
            </div>
            <div className="w-11 h-11 bg-purple-50 rounded-lg flex items-center justify-center">
              <Wrench className="w-5.5 h-5.5 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats ? fmtRs(stats.totalInventoryValue) : "—"}</p>
              <p className={`text-xs mt-0.5 ${stats?.lowStockCount ? "text-red-500 font-medium" : "text-green-600"}`}>
                {stats?.lowStockCount ? `${stats.lowStockCount} low stock items` : "All stocked"}
              </p>
            </div>
            <div className="w-11 h-11 bg-red-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5.5 h-5.5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ LOW STOCK ALERT ═══ */}
      {lowStock.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Low Stock Alert — {lowStock.length} item{lowStock.length > 1 ? "s" : ""} below minimum
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {lowStock.slice(0, 8).map((p, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">
                  {p.name} <span className="text-amber-600">({p.stock}/{p.minStock})</span>
                </span>
              ))}
              {lowStock.length > 8 && (
                <span className="text-xs text-amber-700 font-medium self-center">+{lowStock.length - 8} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ RECENT SALES TABLE + RECENT SERVICES ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Sales — takes 2/3 width */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <h2 className="text-base font-bold text-gray-900">Recent Sales</h2>
            </div>
            <a href="/dashboard/sales" className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">
              View All →
            </a>
          </div>
          {!stats?.recentSales?.length ? (
            <div className="py-16 text-center">
              <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No sales recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-2.5">Invoice</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-2.5">Job Card</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-2.5">Customer</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-2.5">Amount</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-2.5">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSales.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-50 hover:bg-red-50/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-sm font-semibold text-gray-700">{sale.invoiceNumber}</span>
                      </td>
                      <td className="px-5 py-3">
                        {sale.jobCardNumber ? (
                          <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-1 rounded">{sale.jobCardNumber}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-gray-900">{sale.customer}</div>
                        {sale.bikeModel && (
                          <div className="text-xs text-gray-400 mt-0.5">{sale.bikeModel} · {sale.vehicleNumber}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm font-bold text-gray-900">{fmtRs(sale.total)}</span>
                        <div className="text-xs text-gray-400 mt-0.5">{sale.itemCount} item(s)</div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {sale.status === "draft" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            <FileText className="w-3 h-3" /> Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            <Lock className="w-3 h-3" /> Final
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">
                        {new Date(sale.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(sale.date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Services — 1/3 width */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Wrench className="w-5 h-5 text-purple-500" />
              <h2 className="text-base font-bold text-gray-900">Recent Services</h2>
            </div>
            <a href="/dashboard/services" className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">
              View All →
            </a>
          </div>
          {!stats?.recentServices?.length ? (
            <div className="py-16 text-center">
              <Wrench className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No services yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.recentServices.map((svc) => (
                <div key={svc.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-900">{svc.bike}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor[svc.status] || "bg-gray-100 text-gray-700"}`}>
                      {statusLabel[svc.status] || svc.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{svc.service}</p>
                      <p className="text-xs text-gray-400">{svc.customer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{fmtRs(svc.total)}</p>
                      <p className="text-[10px] text-gray-400">{new Date(svc.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
