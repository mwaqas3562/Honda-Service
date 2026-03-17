"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wrench,
  Truck,
  ClipboardList,
  BarChart3,
  FolderOpen,
  Users,
  FileText,
  Hammer,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Job Cards", href: "/dashboard/job-cards", icon: FileText },
  { label: "Inventory", href: "/dashboard/inventory", icon: Package },
  { label: "Categories", href: "/dashboard/categories", icon: FolderOpen },
  { label: "Labour", href: "/dashboard/labours", icon: Hammer },
  { label: "Sales", href: "/dashboard/sales", icon: ShoppingCart },
  { label: "Services", href: "/dashboard/services", icon: Wrench },
  { label: "Purchases", href: "/dashboard/purchases", icon: Truck },
  { label: "Stock Logs", href: "/dashboard/stock-logs", icon: ClipboardList },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
];

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => {
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
      <div className="px-6 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} Honda Service</p>
      </div>
    </aside>
    </>
  );
}
