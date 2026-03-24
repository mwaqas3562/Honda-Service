"use client";

import { useState, useMemo, useEffect } from "react";
import { Package, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import PartRow, { Part } from "@/components/PartRow";

type SortField = "name" | "partNumber" | "category" | "purchasePrice" | "salePrice" | "stock";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

interface PartsTableProps {
  parts: Part[];
  loading: boolean;
  lowStockCount: number;
  onEdit: (part: Part) => void;
  onDelete: (part: Part) => void;
  onAliasUpdate?: (partId: number, aliases: string[]) => void;
  selectedIds?: Set<number>;
  onSelectToggle?: (id: number) => void;
  onSelectAll?: () => void;
}

export default function PartsTable({
  parts,
  loading,
  lowStockCount,
  onEdit,
  onDelete,
  onAliasUpdate,
  selectedIds,
  onSelectToggle,
  onSelectAll,
}: PartsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortField) return parts;
    return [...parts].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [parts, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  // Reset page when parts change
  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const safePage = page >= totalPages ? Math.max(0, totalPages - 1) : page;
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-gray-400 ml-1 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-red-600 ml-1 inline" />
      : <ChevronDown className="w-3 h-3 text-red-600 ml-1 inline" />;
  }

  const thClass = "text-left text-xs font-medium text-gray-500 uppercase px-6 py-3 cursor-pointer hover:text-gray-700 select-none";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
              {selectedIds && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={paged.length > 0 && paged.every((p) => selectedIds.has(p.id))}
                    onChange={onSelectAll}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                </th>
              )}
              <th className={thClass} onClick={() => toggleSort("name")}>
                Name <SortIcon field="name" />
              </th>
              <th className={thClass} onClick={() => toggleSort("partNumber")}>
                Part Number <SortIcon field="partNumber" />
              </th>
              <th className={thClass} onClick={() => toggleSort("category")}>
                Category <SortIcon field="category" />
              </th>
              <th className={thClass} onClick={() => toggleSort("purchasePrice")}>
                Purchase Price <SortIcon field="purchasePrice" />
              </th>
              <th className={thClass} onClick={() => toggleSort("salePrice")}>
                Sale Price <SortIcon field="salePrice" />
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                Margin
              </th>
              <th className={thClass} onClick={() => toggleSort("stock")}>
                Stock <SortIcon field="stock" />
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                Local Names
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  {selectedIds && <td className="px-4 py-4"><div className="w-4 h-4 bg-gray-200 rounded" /></td>}
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-gray-200 rounded-lg" /><div className="h-4 bg-gray-200 rounded w-32" /></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-10" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-10" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto" /></td>
                </tr>
              ))
            ) : parts.length === 0 ? (
              <tr>
                <td colSpan={selectedIds ? 12 : 11} className="px-6 py-12 text-center">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500">No parts found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Try adjusting your search or add a new part
                  </p>
                </td>
              </tr>
            ) : (
              paged.map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAliasUpdate={onAliasUpdate}
                  selected={selectedIds?.has(part.id)}
                  onSelect={onSelectToggle ? () => onSelectToggle(part.id) : undefined}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {sorted.length > 0 ? (
              <>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length} parts
              </>
            ) : (
              "No parts"
            )}
            {lowStockCount > 0 && (
              <span className="ml-2 text-yellow-600 font-medium">
                ({lowStockCount} low stock)
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 4) {
                  pageNum = totalPages - 7 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      page === pageNum
                        ? "bg-red-600 text-white"
                        : "text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
