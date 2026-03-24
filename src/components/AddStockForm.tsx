"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Trash2, Upload, Search, Package } from "lucide-react";
import { Part } from "@/components/PartRow";
import IntegerInput from "@/components/IntegerInput";
import Fuse, { type FuseResult as FuseResultType } from "fuse.js";

/* ── Types ────────────────────────────────────────── */

export interface StockSummaryRow {
  partName: string;
  partNumber: string;
  category: string;
  action: "created" | "updated";
  oldQuantity: number;
  addedQuantity: number;
  newQuantity: number;
  oldPrice: number;
  newAvgPrice: number;
}

interface AddStockFormProps {
  parts: Part[];
  onSuccess: (summary: StockSummaryRow[], message: string) => void;
  onCancel: () => void;
}

interface BulkRow {
  id: number;
  partId: number | null;
  partName: string;
  partNumber: string;
  category: string;
  stock: number;
  purchasePrice: number;
  quantity: string;
  unitPrice: string;
}

type FResult = FuseResultType<Part>;

let rowIdCounter = 1;
function nextRowId() {
  return rowIdCounter++;
}

/* ── Inline Part Search Dropdown ──────────────────── */

function PartSearchInput({
  parts,
  fuse,
  value,
  selectedPart,
  onSelect,
  onClear,
  placeholder,
  autoFocus,
}: {
  parts: Part[];
  fuse: Fuse<Part>;
  value: string;
  selectedPart: Part | null;
  onSelect: (part: Part) => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Top parts by usage
  const topParts = useMemo(
    () => [...parts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 10),
    [parts]
  );

  const results: FResult[] = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query, { limit: 20 }).sort((a, b) => {
      const sd = (a.score || 0) - (b.score || 0);
      if (Math.abs(sd) > 0.05) return sd;
      return (b.item.usageCount || 0) - (a.item.usageCount || 0);
    });
  }, [fuse, query]);

  const displayItems: FResult[] = useMemo(() => {
    if (query.trim()) return results;
    return topParts.map((item) => ({ item, score: undefined, matches: undefined, refIndex: 0 }));
  }, [query, results, topParts]);

  // Reset query when parent value changes (e.g. clear)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const el = dropdownRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, isOpen]);

  const handleSelect = useCallback(
    (part: Part) => {
      onSelect(part);
      setQuery(part.name);
      setIsOpen(false);
      setHighlight(0);
    },
    [onSelect]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || displayItems.length === 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, displayItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(displayItems[highlight].item);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={selectedPart ? selectedPart.name : query}
        onChange={(e) => {
          if (selectedPart) onClear();
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          if (!selectedPart) setIsOpen(true);
        }}
        onClick={() => {
          if (selectedPart) {
            onClear();
            setQuery("");
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Search part by name..."}
        autoFocus={autoFocus}
        className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow ${
          selectedPart ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
        }`}
        autoComplete="off"
      />
      {selectedPart && (
        <button
          type="button"
          onClick={() => {
            onClear();
            setQuery("");
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs"
        >
          ✕
        </button>
      )}

      {isOpen && !selectedPart && (displayItems.length > 0 || (query.trim() && results.length === 0)) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          {!query.trim() && displayItems.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] font-medium text-gray-400 bg-gray-50 border-b border-gray-100 flex items-center gap-1">
              <Package className="w-3 h-3" /> Most Used
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-4 text-xs text-center text-gray-400">
              No part found for &ldquo;{query}&rdquo;
            </div>
          )}
          {displayItems.map((result, idx) => {
            const p = result.item;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors ${
                  idx === highlight ? "bg-red-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate text-xs">{p.name}</div>
                  <div className="text-[10px] text-gray-400">{p.partNumber}</div>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <div className="text-xs font-bold text-gray-700">Rs {Math.round(p.purchasePrice).toLocaleString()}</div>
                  <div className={`text-[10px] ${p.stock <= 3 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                    Stock: {p.stock}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────────────── */

export default function AddStockForm({
  parts,
  onSuccess,
  onCancel,
}: AddStockFormProps) {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── Fuse index ── */
  const fuse = useMemo(() => {
    return new Fuse(parts, {
      keys: [
        { name: "name", weight: 0.5 },
        { name: "aliases", weight: 0.35 },
        { name: "partNumber", weight: 0.15 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1,
    });
  }, [parts]);

  /* ── Single-item state ── */
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [note, setNote] = useState("");

  const [preview, setPreview] = useState<{ newStock: number; newAvgPrice: number } | null>(null);

  // Auto-fill price when part selected
  useEffect(() => {
    if (selectedPart && !purchasePrice) {
      setPurchasePrice(String(Math.round(selectedPart.purchasePrice)));
    }
  }, [selectedPart, purchasePrice]);

  // Live preview
  useEffect(() => {
    const qty = Number(quantity);
    const price = Number(purchasePrice);
    if (!selectedPart || qty <= 0 || price < 0) {
      setPreview(null);
      return;
    }
    const oldQty = selectedPart.stock;
    const oldPrice = selectedPart.purchasePrice;
    const newStock = oldQty + qty;
    const newAvgPrice = Math.round(((oldQty * oldPrice + qty * price) / newStock) * 100) / 100;
    setPreview({ newStock, newAvgPrice });
  }, [selectedPart, quantity, purchasePrice]);

  /* ── Bulk state ── */
  const emptyRow = (): BulkRow => ({
    id: nextRowId(),
    partId: null,
    partName: "",
    partNumber: "",
    category: "",
    stock: 0,
    purchasePrice: 0,
    quantity: "",
    unitPrice: "",
  });
  const [rows, setRows] = useState<BulkRow[]>([emptyRow(), emptyRow(), emptyRow()]);

  /* ── Bulk helpers ── */
  function selectBulkPart(rowId: number, part: Part) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              partId: part.id,
              partName: part.name,
              partNumber: part.partNumber,
              category: part.category,
              stock: part.stock,
              purchasePrice: part.purchasePrice,
              unitPrice: r.unitPrice || String(Math.round(part.purchasePrice)),
            }
          : r
      )
    );
  }

  function clearBulkPart(rowId: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, partId: null, partName: "", partNumber: "", category: "", stock: 0, purchasePrice: 0 }
          : r
      )
    );
  }

  function updateBulkField(rowId: number, field: "quantity" | "unitPrice", value: string) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  /* ── Submit: Single ── */
  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const qty = Number(quantity);
    const price = Number(purchasePrice);

    if (!selectedPart) return setError("Please search and select a part");
    if (qty <= 0) return setError("Quantity must be greater than zero");
    if (price < 0) return setError("Price cannot be negative");

    setLoading(true);
    try {
      const item = {
        partId: selectedPart.id,
        name: selectedPart.name,
        partNumber: selectedPart.partNumber,
        category: selectedPart.category,
        quantity: qty,
        purchasePrice: price,
        note: note.trim() || undefined,
      };

      const res = await fetch("/api/parts/bulk-stock-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item] }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add stock");

      onSuccess(data.summary, data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /* ── Submit: Bulk ── */
  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filledRows = rows.filter((r) => r.partId);

    if (filledRows.length === 0) {
      return setError("Search and select at least one part");
    }

    for (let i = 0; i < filledRows.length; i++) {
      const r = filledRows[i];
      if (Number(r.quantity) <= 0) return setError(`"${r.partName}": Quantity must be positive`);
      if (Number(r.unitPrice) < 0) return setError(`"${r.partName}": Price cannot be negative`);
    }

    setLoading(true);
    try {
      const items = filledRows.map((r) => ({
        partId: r.partId,
        name: r.partName,
        partNumber: r.partNumber,
        category: r.category,
        quantity: Number(r.quantity),
        purchasePrice: Number(r.unitPrice),
      }));

      const res = await fetch("/api/parts/bulk-stock-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process bulk entry");

      onSuccess(data.summary, data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /* ── Styles ── */
  const inputClass =
    "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";
  const tabClass = (active: boolean) =>
    `flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      active
        ? "bg-red-600 text-white shadow-sm"
        : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
    }`;

  const bulkTotal = rows
    .filter((r) => r.partId)
    .reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);
  const filledCount = rows.filter((r) => r.partId).length;

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          type="button"
          className={tabClass(tab === "single")}
          onClick={() => setTab("single")}
        >
          Single Item
        </button>
        <button
          type="button"
          className={tabClass(tab === "bulk")}
          onClick={() => setTab("bulk")}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Bulk Add
          </span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* ─── SINGLE ITEM TAB ─── */}
      {tab === "single" && (
        <form onSubmit={handleSingleSubmit} className="space-y-4">
          {/* Part Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Part
            </label>
            <PartSearchInput
              parts={parts}
              fuse={fuse}
              value={searchValue}
              selectedPart={selectedPart}
              onSelect={(part) => {
                setSelectedPart(part);
                setSearchValue(part.name);
                setPurchasePrice(String(Math.round(part.purchasePrice)));
              }}
              onClear={() => {
                setSelectedPart(null);
                setSearchValue("");
                setPurchasePrice("");
                setPreview(null);
              }}
              placeholder="Type part name, local name, or number..."
              autoFocus
            />
            {selectedPart && (
              <div className="flex items-center gap-3 mt-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                <span>✓ <strong>{selectedPart.name}</strong></span>
                <span className="text-green-600">Stock: {selectedPart.stock}</span>
                <span className="text-green-600">@ Rs {Math.round(selectedPart.purchasePrice).toLocaleString()}</span>
                <span className="text-gray-400 ml-auto">{selectedPart.partNumber}</span>
              </div>
            )}
          </div>

          {/* Qty + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <IntegerInput
                value={quantity}
                onChange={setQuantity}
                className={inputClass}
                placeholder="0"
                showStepper
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price (per unit)
              </label>
              <IntegerInput
                value={purchasePrice}
                onChange={setPurchasePrice}
                className={inputClass}
                placeholder="0"
              />
            </div>
          </div>

          {/* Live Preview */}
          {preview && selectedPart && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800">Preview</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-600">Current Stock:</span>{" "}
                  <span className="font-medium text-blue-900">
                    {selectedPart.stock} units @ Rs{" "}
                    {Math.round(selectedPart.purchasePrice).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600">Adding:</span>{" "}
                  <span className="font-medium text-blue-900">
                    {quantity} units @ Rs {Math.round(Number(purchasePrice)).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-blue-200">
                  <span className="text-blue-600">Updated Stock:</span>{" "}
                  <span className="font-bold text-blue-900">
                    {preview.newStock} units @ Rs{" "}
                    {Math.round(preview.newAvgPrice).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="e.g. Supplier: ABC Traders, Invoice #123"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedPart}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Processing..." : "Add Stock"}
            </button>
          </div>
        </form>
      )}

      {/* ─── BULK ADD TAB ─── */}
      {tab === "bulk" && (
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <p className="text-xs text-gray-500">Search and select parts by name. Quantity defaults to 1.</p>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div
                key={row.id}
                className={`flex items-start gap-2 p-2 rounded-lg border ${
                  row.partId ? "border-green-200 bg-green-50/50" : "border-gray-100 bg-gray-50/50"
                }`}
              >
                <div className="text-xs text-gray-400 font-medium pt-2.5 w-5 shrink-0">
                  {i + 1}
                </div>
                {/* Part search */}
                <div className="flex-1 min-w-0">
                  <PartSearchInput
                    parts={parts}
                    fuse={fuse}
                    value={row.partName}
                    selectedPart={row.partId ? (parts.find((p) => p.id === row.partId) || null) : null}
                    onSelect={(part) => selectBulkPart(row.id, part)}
                    onClear={() => clearBulkPart(row.id)}
                    placeholder={`Search part ${i + 1}...`}
                  />
                  {row.partId && (
                    <div className="text-[10px] text-gray-400 mt-0.5 px-1">
                      {row.partNumber} · Stock: {row.stock} · Current: Rs {Math.round(row.purchasePrice).toLocaleString()}
                    </div>
                  )}
                </div>
                {/* Qty */}
                <div className="w-28 shrink-0">
                  <IntegerInput
                    value={row.quantity}
                    onChange={(v) => updateBulkField(row.id, "quantity", v)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-500 text-center"
                    placeholder="Qty"
                    showStepper
                    min={0}
                  />
                </div>
                {/* Price */}
                <div className="w-24 shrink-0">
                  <IntegerInput
                    value={row.unitPrice}
                    onChange={(v) => updateBulkField(row.id, "unitPrice", v)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-500 text-right"
                    placeholder="Price"
                  />
                </div>
                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
            {filledCount > 0 && (
              <div className="text-sm text-gray-600">
                {filledCount} part(s) · Total: <span className="font-bold text-gray-900">Rs {Math.round(bulkTotal).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || filledCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Processing..." : `Add Stock for ${filledCount} Part(s)`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
