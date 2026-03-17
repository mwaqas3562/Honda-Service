"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  "job-cards": "Job Cards",
  inventory: "Inventory",
  categories: "Categories",
  sales: "Sales",
  services: "Services",
  purchases: "Purchases",
  "stock-logs": "Stock Logs",
  customers: "Customers",
  reports: "Reports",
};

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    label: labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <div className="mb-6">
      {crumbs.length > 1 && (
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-2">
          <Link href="/dashboard" className="hover:text-red-600 transition-colors">
            <Home className="w-3.5 h-3.5" />
          </Link>
          {crumbs.map((c) => (
            <span key={c.href} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-gray-400" />
              {c.isLast ? (
                <span className="text-gray-700 font-medium">{c.label}</span>
              ) : (
                <Link href={c.href} className="hover:text-red-600 transition-colors">{c.label}</Link>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
