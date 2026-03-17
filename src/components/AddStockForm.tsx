"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Part } from "@/components/PartRow";

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
  name: string;
  partNumber: string;
  category: string;
  quantity: string;
  purchasePrice: string;
  salePrice: string;
}

const CATEGORIES = [
  "Engine",
  "Brakes",
  "Transmission",
  "Electrical",
  "Body Parts",
  "Filters",
  "Ignition",
  "Suspension",
  "Exhaust",
  "Oils & Lubricants",
  "Other",
];

let rowIdCounter = 1;
function nextRowId() {
  return rowIdCounter++;
}

/* ── Component ────────────────────────────────────── */

export default function AddStockForm({
  parts,
  onSuccess,
  onCancel,
}: AddStockFormProps) {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── Single-item state ── */
  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [note, setNote] = useState("");

  // New-part fields (shown when part doesn't exist)
  const [isNewPart, setIsNewPart] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [minStock, setMinStock] = useState("5");

  const [matchedPart, setMatchedPart] = useState<Part | null>(null);
  const [preview, setPreview] = useState<{ newStock: number; newAvgPrice: number } | null>(null);

  /* ── Bulk state ── */
  const emptyRow = (): BulkRow => ({
    id: nextRowId(),
    name: "",
    partNumber: "",
    category: "",
    quantity: "",
    purchasePrice: "",
    salePrice: "",
  });
  const [rows, setRows] = useState<BulkRow[]>([emptyRow(), emptyRow()]);

  /* ── Single-item lookups ── */
  useEffect(() => {
    const trimmed = partNumber.trim();
    if (!trimmed) {
      setMatchedPart(null);
      setIsNewPart(false);
      setPreview(null);
      return;
    }
    const found = parts.find(
      (p) => p.partNumber.toLowerCase() === trimmed.toLowerCase()
    );
    if (found) {
      setMatchedPart(found);
      setIsNewPart(false);
    } else {
      setMatchedPart(null);
      setIsNewPart(true);
    }
  }, [partNumber, parts]);

  useEffect(() => {
    const qty = Number(quantity);
    const price = Number(purchasePrice);
    if (!matchedPart || qty <= 0 || price < 0) {
      setPreview(null);
      return;
    }
    const oldQty = matchedPart.stock;
    const oldPrice = matchedPart.purchasePrice;
    const newStock = oldQty + qty;
    const newAvgPrice =
      Math.round(
        ((oldQty * oldPrice + qty * price) / newStock) * 100
      ) / 100;
    setPreview({ newStock, newAvgPrice });
  }, [matchedPart, quantity, purchasePrice]);

  /* ── Bulk row helpers ── */
  function updateRow(id: number, field: keyof BulkRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  /* ── Submit handlers ── */
  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const qty = Number(quantity);
    const price = Number(purchasePrice);

    if (!partNumber.trim()) return setError("Part number is required");
    if (qty <= 0) return setError("Quantity must be greater than zero");
    if (price < 0) return setError("Price cannot be negative");
    if (isNewPart && !name.trim()) return setError("Name is required for new part");
    if (isNewPart && !category) return setError("Category is required for new part");

    setLoading(true);
    try {
      // Use bulk endpoint with single item for consistent summary format
      const item = {
        name: isNewPart ? name.trim() : matchedPart!.name,
        partNumber: partNumber.trim(),
        category: isNewPart ? category : matchedPart!.category,
        quantity: qty,
        purchasePrice: price,
        salePrice: isNewPart ? Number(salePrice) || 0 : undefined,
        minStock: isNewPart ? Number(minStock) || 5 : undefined,
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

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Filter out completely empty rows
    const filledRows = rows.filter(
      (r) => r.name.trim() || r.partNumber.trim()
    );

    if (filledRows.length === 0) {
      return setError("Add at least one item");
    }

    // Validate each filled row
    for (let i = 0; i < filledRows.length; i++) {
      const r = filledRows[i];
      if (!r.name.trim()) return setError(`Row ${i + 1}: Name is required`);
      if (!r.partNumber.trim())
        return setError(`Row ${i + 1}: Part number is required`);
      if (!r.category) return setError(`Row ${i + 1}: Category is required`);
      if (Number(r.quantity) <= 0)
        return setError(`Row ${i + 1}: Quantity must be positive`);
      if (Number(r.purchasePrice) < 0)
        return setError(`Row ${i + 1}: Price cannot be negative`);
    }

    setLoading(true);
    try {
      const items = filledRows.map((r) => ({
        name: r.name.trim(),
        partNumber: r.partNumber.trim(),
        category: r.category,
        quantity: Number(r.quantity),
        purchasePrice: Number(r.purchasePrice),
        salePrice: Number(r.salePrice) || 0,
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
          {/* Part Number with autocomplete */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Part Number
            </label>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              className={inputClass}
              placeholder="e.g. HON-BRK-001"
              list="part-numbers-single"
            />
            <datalist id="part-numbers-single">
              {parts.map((p) => (
                <option key={p.id} value={p.partNumber}>
                  {p.name}
                </option>
              ))}
            </datalist>
            {matchedPart && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Found: {matchedPart.name} — Stock: {matchedPart.stock} units
                @ Rs {Math.round(matchedPart.purchasePrice).toLocaleString()}
              </p>
            )}
            {isNewPart && partNumber.trim() && (
              <p className="text-xs text-blue-600 mt-1">
                New part — fill details below
              </p>
            )}
          </div>

          {/* Qty + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
                placeholder="0"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price (per unit)
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className={inputClass}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Live Preview for existing parts */}
          {preview && matchedPart && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800">Preview</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-600">Old Stock:</span>{" "}
                  <span className="font-medium text-blue-900">
                    {matchedPart.stock} units @ Rs{" "}
                    {Math.round(matchedPart.purchasePrice).toLocaleString()}
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

          {/* New Part Fields */}
          {isNewPart && partNumber.trim() && (
            <div className="border border-blue-200 rounded-lg p-4 space-y-4 bg-blue-50/50">
              <p className="text-sm font-medium text-blue-700">
                New Part Details
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Part Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Brake Shoe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Price
                  </label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Stock Level
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className={inputClass}
                    min="0"
                  />
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
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : isNewPart
                ? "Create & Add Stock"
                : "Add Stock"}
            </button>
          </div>
        </form>
      )}

      {/* ─── BULK ADD TAB ─── */}
      {tab === "bulk" && (
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-2 py-2 font-medium text-gray-600 text-xs">
                    Name
                  </th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 text-xs">
                    Part #
                  </th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 text-xs">
                    Category
                  </th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 text-xs w-20">
                    Qty
                  </th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 text-xs w-24">
                    Price (Rs)
                  </th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 text-xs w-24">
                    Sale (Rs)
                  </th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="px-1 py-1.5">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) =>
                          updateRow(row.id, "name", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder={`Part ${i + 1}`}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="text"
                        value={row.partNumber}
                        onChange={(e) =>
                          updateRow(row.id, "partNumber", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="HON-..."
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <select
                        value={row.category}
                        onChange={(e) =>
                          updateRow(row.id, "category", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="">--</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) =>
                          updateRow(row.id, "quantity", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        min="1"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        value={row.purchasePrice}
                        onChange={(e) =>
                          updateRow(row.id, "purchasePrice", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        value={row.salePrice}
                        onChange={(e) =>
                          updateRow(row.id, "salePrice", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>

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
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : `Add ${
                    rows.filter((r) => r.name.trim() || r.partNumber.trim())
                      .length
                  } Item(s)`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
