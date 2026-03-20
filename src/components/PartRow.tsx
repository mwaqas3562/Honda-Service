"use client";

import { useState, useRef } from "react";
import { Pencil, Trash2, Package, AlertTriangle, Check, X } from "lucide-react";

export interface Part {
  id: number;
  name: string;
  partNumber: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  aliases: string[];
  usageCount?: number;
}

interface PartRowProps {
  part: Part;
  onEdit: (part: Part) => void;
  onDelete: (part: Part) => void;
  onAliasUpdate?: (partId: number, aliases: string[]) => void;
  selected?: boolean;
  onSelect?: () => void;
}

function getStockStatus(part: Part) {
  if (part.stock === 0)
    return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
  if (part.stock <= part.minStock)
    return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700" };
  return { label: "In Stock", color: "bg-green-100 text-green-700" };
}

export default function PartRow({ part, onEdit, onDelete, onAliasUpdate, selected, onSelect }: PartRowProps) {
  const status = getStockStatus(part);
  const isLow = part.stock <= part.minStock;
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const aliasRef = useRef<HTMLInputElement>(null);

  function startEditAlias() {
    setAliasInput(part.aliases.join(", "));
    setEditingAlias(true);
    setTimeout(() => aliasRef.current?.focus(), 0);
  }

  function saveAlias() {
    const newAliases = aliasInput
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    onAliasUpdate?.(part.id, newAliases);
    setEditingAlias(false);
  }

  function cancelAlias() {
    setEditingAlias(false);
  }

  return (
    <tr
      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isLow ? "bg-red-50/40" : ""
      } ${selected ? "bg-blue-50/50" : ""}`}
    >
      {onSelect && (
        <td className="px-4 py-4">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onSelect}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
        </td>
      )}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isLow ? "bg-red-100" : "bg-red-50"
            }`}
          >
            {isLow ? (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            ) : (
              <Package className="w-4 h-4 text-red-600" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-900">{part.name}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 font-mono">
        {part.partNumber}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{part.category}</td>
      <td className="px-6 py-4 text-sm text-gray-900">
        Rs {Math.round(part.purchasePrice).toLocaleString()}
      </td>
      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
        Rs {Math.round(part.salePrice).toLocaleString()}
      </td>
      <td className="px-6 py-4">
        {(() => {
          const margin = part.purchasePrice > 0 ? ((part.salePrice - part.purchasePrice) / part.purchasePrice) * 100 : 0;
          const color = margin >= 30 ? "text-green-600" : margin >= 15 ? "text-yellow-600" : "text-red-600";
          return <span className={`text-sm font-medium ${color}`}>{margin.toFixed(0)}%</span>;
        })()}
      </td>
      <td className="px-6 py-4">
        <span
          className={`text-sm font-medium ${
            isLow ? "text-red-600" : "text-gray-900"
          }`}
        >
          {part.stock}
        </span>
        <span className="text-xs text-gray-400 ml-1">/ {part.minStock} min</span>
      </td>
      <td className="px-6 py-4">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}
        >
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 max-w-[220px]">
        {editingAlias ? (
          <div className="flex items-center gap-1">
            <input
              ref={aliasRef}
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveAlias(); }
                if (e.key === "Escape") cancelAlias();
              }}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="gutka, chain set, garari"
            />
            <button onClick={saveAlias} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancelAlias} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            onClick={startEditAlias}
            className="cursor-pointer group min-h-[28px] flex items-center"
            title="Click to edit local names"
          >
            {part.aliases.length > 0 ? (
              <span className="text-xs text-gray-500 truncate group-hover:text-red-600 transition-colors">
                {part.aliases.join(", ")}
              </span>
            ) : (
              <span className="text-xs text-gray-300 italic group-hover:text-red-400 transition-colors">
                + Add local names
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(part)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(part)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
