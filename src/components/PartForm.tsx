"use client";

import { useState } from "react";

export interface PartFormData {
  name: string;
  partNumber: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  aliases: string[];
}

interface PartFormProps {
  initialData?: PartFormData;
  onSubmit: (data: PartFormData) => Promise<void>;
  onCancel: () => void;
}

const categories = [
  "Filters",
  "Brakes",
  "Transmission",
  "Ignition",
  "Electrical",
  "Body Parts",
  "Engine",
  "Suspension",
  "Oils & Lubricants",
  "Other",
];

const defaultData: PartFormData = {
  name: "",
  partNumber: "",
  category: "",
  purchasePrice: 0,
  salePrice: 0,
  stock: 0,
  minStock: 5,
  aliases: [],
};

export default function PartForm({ initialData, onSubmit, onCancel }: PartFormProps) {
  const [form, setForm] = useState<PartFormData>(initialData || defaultData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.partNumber.trim()) errs.partNumber = "Part number is required";
    if (!form.category) errs.category = "Category is required";
    if (form.purchasePrice < 0) errs.purchasePrice = "Must be 0 or more";
    if (form.salePrice < 0) errs.salePrice = "Must be 0 or more";
    if (form.stock < 0) errs.stock = "Must be 0 or more";
    if (form.minStock < 0) errs.minStock = "Must be 0 or more";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(form);
      if (!initialData) setForm(defaultData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  function update(field: keyof PartFormData, value: string | number | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  const inputClass = (field: string) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
      errors[field] ? "border-red-400" : "border-gray-200"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {serverError}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className={inputClass("name")}
          placeholder="e.g. Engine Oil Filter"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Part Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
        <input
          type="text"
          value={form.partNumber}
          onChange={(e) => update("partNumber", e.target.value)}
          className={inputClass("partNumber")}
          placeholder="e.g. HON-OIL-001"
        />
        {errors.partNumber && <p className="text-xs text-red-500 mt-1">{errors.partNumber}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          className={inputClass("category")}
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
      </div>

      {/* Local Names / Aliases */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Local Names <span className="text-gray-400 font-normal">(comma separated)</span>
        </label>
        <input
          type="text"
          value={form.aliases.join(", ")}
          onChange={(e) => {
            const vals = e.target.value.split(",").map((a) => a.trimStart());
            update("aliases", vals);
          }}
          onBlur={() => {
            // Clean up on blur: trim, lowercase, dedupe, remove empties
            const cleaned = [...new Set(form.aliases.map((a) => a.trim().toLowerCase()).filter(Boolean))];
            update("aliases", cleaned);
          }}
          className={inputClass("aliases")}
          placeholder="e.g. gutka, chain garari, sprocket"
        />
        <p className="text-xs text-gray-400 mt-1">These names will be searchable in inventory &amp; sales</p>
      </div>

      {/* Prices Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (Rs)</label>
          <input
            type="number"
            min="0"
            value={form.purchasePrice}
            onChange={(e) => update("purchasePrice", Math.round(parseFloat(e.target.value) || 0))}
            className={inputClass("purchasePrice")}
          />
          {errors.purchasePrice && <p className="text-xs text-red-500 mt-1">{errors.purchasePrice}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (Rs)</label>
          <input
            type="number"
            min="0"
            value={form.salePrice}
            onChange={(e) => update("salePrice", Math.round(parseFloat(e.target.value) || 0))}
            className={inputClass("salePrice")}
          />
          {errors.salePrice && <p className="text-xs text-red-500 mt-1">{errors.salePrice}</p>}
        </div>
      </div>

      {/* Stock Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
          <input
            type="number"
            min="0"
            value={form.stock}
            onChange={(e) => update("stock", parseInt(e.target.value) || 0)}
            className={inputClass("stock")}
          />
          {errors.stock && <p className="text-xs text-red-500 mt-1">{errors.stock}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Alert</label>
          <input
            type="number"
            min="0"
            value={form.minStock}
            onChange={(e) => update("minStock", parseInt(e.target.value) || 0)}
            className={inputClass("minStock")}
          />
          {errors.minStock && <p className="text-xs text-red-500 mt-1">{errors.minStock}</p>}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Saving..." : initialData ? "Update Part" : "Add Part"}
        </button>
      </div>
    </form>
  );
}
