"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wrench,
  Truck,
  ClipboardList,
  BarChart3,
  FolderOpen,
  FileText,
  Hammer,
  TrendingDown,
  UserCog,
  Trophy,
  Target,
  Banknote,
  PieChart,
  ArrowRightLeft,
  Boxes,
  UserSearch,
  Receipt,
  TrendingUp,
  Wallet,
  CalendarCheck,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
};

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Job Cards", href: "/dashboard/job-cards", icon: FileText },
  { label: "Inventory", href: "/dashboard/inventory", icon: Package },
  { label: "Stock Alerts", href: "/dashboard/stock-alerts", icon: TrendingDown },
  { label: "Categories", href: "/dashboard/categories", icon: FolderOpen },
  { label: "Labour", href: "/dashboard/labours", icon: Hammer },
  { label: "Sales", href: "/dashboard/sales", icon: ShoppingCart },
  { label: "Services", href: "/dashboard/services", icon: Wrench },
  { label: "Purchases", href: "/dashboard/purchases", icon: Truck },
  { label: "Stock Logs", href: "/dashboard/stock-logs", icon: ClipboardList },
  { label: "Staff", href: "/dashboard/staff", icon: UserCog },
  { label: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
  { label: "Salary", href: "/dashboard/salary", icon: Wallet },
  { label: "Bonus & Rewards", href: "/dashboard/bonus-rewards", icon: Trophy },
  { label: "Wheel Balancer", href: "/dashboard/wheel-balancer", icon: Target },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    children: [
      { label: "Overview", href: "/dashboard/reports", icon: PieChart },
      { label: "Daily Cash", href: "/dashboard/reports/daily-cash", icon: Banknote },
      { label: "Transactions", href: "/dashboard/reports/transactions", icon: ArrowRightLeft },
      { label: "Expenses", href: "/dashboard/reports/expenses", icon: Receipt },
      { label: "Inventory", href: "/dashboard/reports/inventory", icon: Boxes },
      { label: "Customers", href: "/dashboard/reports/customers", icon: UserSearch },
      { label: "Profit Report", href: "/dashboard/reports/profit", icon: TrendingUp },
      { label: "Customer Profit", href: "/dashboard/reports/profit/customers", icon: TrendingUp },
    ],
  },
];

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const isReportsActive = pathname.startsWith("/dashboard/reports");
  const [reportsOpen, setReportsOpen] = useState(isReportsActive);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="font-semibold text-lg text-gray-900">Honda Service</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg md:hidden">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          // Collapsible group (Reports)
          if (item.children) {
            const anyChildActive = item.children.some(
              (c) => pathname === c.href || (c.href !== "/dashboard/reports" && pathname.startsWith(c.href))
            );
            const groupActive = anyChildActive || pathname === item.href;

            return (
              <div key={item.label}>
                <button
                  onClick={() => setReportsOpen((o) => !o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    groupActive
                      ? "bg-red-50 text-red-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      reportsOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {reportsOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                    {item.children.map((child) => {
                      const childActive =
                        child.href === "/dashboard/reports"
                          ? pathname === "/dashboard/reports"
                          : pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                            childActive
                              ? "bg-red-50 text-red-700"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                          }`}
                        >
                          <child.icon className="w-4 h-4" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Regular item
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-red-50 text-red-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-200 space-y-2">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-5 h-5" />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
        <p className="text-xs text-gray-500 px-3">© {new Date().getFullYear()} Honda Service</p>
      </div>
    </aside>
    </>
  );
}
