"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Prevent scroll-wheel and arrow keys from changing number input values globally
  useEffect(() => {
    function handleWheel(e: WheelEvent) {
      const el = e.target as HTMLInputElement;
      if (el.tagName === "INPUT" && (el.type === "number" || el.inputMode === "numeric")) {
        el.blur();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLInputElement;
      if (el.tagName === "INPUT" && el.type === "number" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
      }
    }
    document.addEventListener("wheel", handleWheel, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header onToggleSidebar={() => setSidebarOpen((o) => !o)} />
          <main className="flex-1 p-4 md:p-6 bg-gray-50">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
