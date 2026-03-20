"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, User, Package, ShoppingCart, Wrench, Menu } from "lucide-react";

interface SearchResult {
  type: "part" | "sale" | "service";
  id: number;
  title: string;
  subtitle: string;
}

export default function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault();
      navigate(results[activeIdx]);
    } else if (e.key === "Escape") {
      setShowResults(false);
      inputRef.current?.blur();
    }
  }

  function handleSearch(value: string) {
    setQuery(value);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setShowResults(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const [partsRes, salesRes, servicesRes] = await Promise.all([
          fetch(`/api/parts?search=${encodeURIComponent(value)}`),
          fetch("/api/sales"),
          fetch("/api/services"),
        ]);

        const found: SearchResult[] = [];
        if (partsRes.ok) {
          const partsJson = await partsRes.json();
          const parts = partsJson.data ?? partsJson;
          parts.slice(0, 5).forEach((p: { id: number; name: string; partNumber: string; stock: number }) => {
            found.push({ type: "part", id: p.id, title: p.name, subtitle: `${p.partNumber} · Stock: ${p.stock}` });
          });
        }
        if (salesRes.ok) {
          const salesJson = await salesRes.json();
          const sales = salesJson.data ?? salesJson;
          const q = value.toLowerCase();
          sales.filter((s: { customer: string | null }) => (s.customer || "").toLowerCase().includes(q)).slice(0, 3).forEach((s: { id: number; customer: string | null; total: number }) => {
            found.push({ type: "sale", id: s.id, title: `Sale S${String(s.id).padStart(3, "0")}`, subtitle: `${s.customer || "Walk-in"} · Rs ${Math.round(s.total).toLocaleString()}` });
          });
        }
        if (servicesRes.ok) {
          const svcsJson = await servicesRes.json();
          const svcs = svcsJson.data ?? svcsJson;
          const q = value.toLowerCase();
          svcs.filter((s: { customerName: string; bikeModel: string }) => s.customerName.toLowerCase().includes(q) || s.bikeModel.toLowerCase().includes(q)).slice(0, 3).forEach((s: { id: number; customerName: string; bikeModel: string }) => {
            found.push({ type: "service", id: s.id, title: `Service SV${String(s.id).padStart(3, "0")}`, subtitle: `${s.customerName} · ${s.bikeModel}` });
          });
        }
        setResults(found);
        setShowResults(true);
      } catch (err) { console.error(err); }
      finally { setSearching(false); }
    }, 300);
  }

  function navigate(r: SearchResult) {
    setShowResults(false);
    setQuery("");
    if (r.type === "part") router.push("/dashboard/inventory");
    else if (r.type === "sale") router.push("/dashboard/sales");
    else router.push("/dashboard/services");
  }

  const iconMap = { part: Package, sale: ShoppingCart, service: Wrench };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
      {/* Mobile hamburger */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="mr-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      {/* Search */}
      <div className="relative w-full max-w-96" ref={wrapperRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search parts, sales, services..."
          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50 max-h-72 overflow-y-auto">
            {searching ? (
              <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400">
                No results found for &ldquo;{query}&rdquo;
                <p className="text-xs text-gray-500 mt-1">Try a shorter or different keyword</p>
              </div>
            ) : (
              results.map((r, i) => {
                const Icon = iconMap[r.type];
                return (
                  <button key={`${r.type}-${r.id}-${i}`} onClick={() => navigate(r)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-100 last:border-0 transition-colors ${i === activeIdx ? "bg-red-50" : "hover:bg-gray-50"}`}>
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500">{r.subtitle}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Admin</p>
            <p className="text-xs text-gray-500">admin@honda.com</p>
          </div>
        </div>
      </div>
    </header>
  );
}
