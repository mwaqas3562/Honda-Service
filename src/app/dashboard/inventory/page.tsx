"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, PackagePlus, RefreshCw, Upload, FileSpreadsheet, CheckCircle, XCircle, Download, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import PageHeader from "@/components/PageHeader";
import SearchBar from "@/components/SearchBar";
import FilterDropdown from "@/components/FilterDropdown";
import PartsTable from "@/components/PartsTable";
import { Part } from "@/components/PartRow";
import Modal from "@/components/Modal";
import PartForm from "@/components/PartForm";
import AddStockForm, { StockSummaryRow } from "@/components/AddStockForm";
import StockSummary from "@/components/StockSummary";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

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
  "Other",
];

interface ReorderSuggestion {
  id: number;
  name: string;
  partNumber: string;
  stock: number;
  minStock: number;
  deficit: number;
  suggestedQty: number;
  purchasePrice: number;
  lastVendor: string | null;
  lastPurchasePrice: number | null;
  lastPurchaseDate: string | null;
  estimatedCost: number;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [lowStockParts, setLowStockParts] = useState<Part[]>([]);
  const [stockSummary, setStockSummary] = useState<{ rows: StockSummaryRow[]; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestion[]>([]);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<"pick" | "map" | "done">("pick");
  const [uploadHeaders, setUploadHeaders] = useState<string[]>([]);
  const [uploadSampleRows, setUploadSampleRows] = useState<Record<string, string>[]>([]);
  const [uploadTotalRows, setUploadTotalRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category) params.set("category", category);
      const res = await fetch(`/api/parts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setParts(json.data ?? json);
      }
    } catch (err) {
      console.error("Failed to fetch parts:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  const fetchLowStock = useCallback(async () => {
    try {
      const res = await fetch("/api/parts/low-stock");
      if (res.ok) {
        const data = await res.json();
        setLowStockParts(data);
      }
    } catch (err) {
      console.error("Failed to fetch low stock:", err);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  useEffect(() => {
    fetchLowStock();
  }, [fetchLowStock]);

  const fetchReorderSuggestions = async () => {
    setReorderLoading(true);
    try {
      const res = await fetch("/api/parts/reorder-suggestions");
      if (res.ok) {
        const data = await res.json();
        setReorderSuggestions(data);
      }
    } catch (err) {
      console.error("Failed to fetch reorder suggestions:", err);
    } finally {
      setReorderLoading(false);
    }
  };

  const openReorderModal = () => {
    setShowReorderModal(true);
    fetchReorderSuggestions();
  };

  const downloadTemplate = () => {
    const templateData = parts.length > 0
      ? parts.map((p) => ({
          "Name": p.name,
          "Part Number": p.partNumber,
          "Category": p.category,
          "Purchase Price": p.purchasePrice,
          "Sale Price": p.salePrice,
          "Stock": p.stock,
          "Min Stock": p.minStock,
        }))
      : [{
          "Name": "Oil Filter",
          "Part Number": "HON-OF-001",
          "Category": "Filters",
          "Purchase Price": 150,
          "Sale Price": 250,
          "Stock": 20,
          "Min Stock": 5,
        }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "honda_inventory.xlsx");
  };

  const handleFileSelect = async (file: File) => {
    setUploadFile(file);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "preview");
      const res = await fetch("/api/parts/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.preview) {
        setUploadHeaders(data.originalHeaders);
        setUploadSampleRows(data.sampleRawRows);
        setUploadTotalRows(data.totalRows);
        setColumnMapping(data.detectedMapping);
        setUploadStep("map");
      }
    } catch {
      // Preview failed
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("mode", "import");
      formData.append("mapping", JSON.stringify(columnMapping));
      const res = await fetch("/api/parts/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setUploadResult(data);
        setUploadStep("done");
        fetchParts();
        fetchLowStock();
      } else {
        setUploadResult({ success: false, totalRows: 0, created: 0, updated: 0, skipped: 0, errors: [data.error] });
        setUploadStep("done");
      }
    } catch {
      setUploadResult({ success: false, totalRows: 0, created: 0, updated: 0, skipped: 0, errors: ["Upload failed"] });
      setUploadStep("done");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (part: Part) => {
    setDeleteTarget(part);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/parts/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast(`"${deleteTarget.name}" deleted`, "success");
        fetchParts();
        fetchLowStock();
      } else {
        toast("Failed to delete part", "error");
      }
    } catch (err) {
      console.error("Failed to delete part:", err);
      toast("Failed to delete part", "error");
    }
    setDeleteTarget(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected parts? This cannot be undone.`)) return;
    let deleted = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch(`/api/parts/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch {}
    }
    toast(`Deleted ${deleted} of ${selectedIds.size} parts`, deleted > 0 ? "success" : "error");
    setSelectedIds(new Set());
    fetchParts();
    fetchLowStock();
  };

  const handleEdit = (part: Part) => {
    setEditPart(part);
  };

  const handleAddSubmit = async (data: import("@/components/PartForm").PartFormData) => {
    const res = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to add part");
    }
    setShowAddModal(false);
    toast("Part added successfully", "success");
    fetchParts();
    fetchLowStock();
  };

  const handleEditSubmit = async (data: import("@/components/PartForm").PartFormData) => {
    if (!editPart) return;
    const res = await fetch(`/api/parts/${editPart.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update part");
    }
    setEditPart(null);
    toast("Part updated successfully", "success");
    fetchParts();
    fetchLowStock();
  };

  const handleStockSuccess = (summary: StockSummaryRow[], message: string) => {
    setShowStockModal(false);
    setStockSummary({ rows: summary, message });
    toast(message, "success");
    fetchParts();
    fetchLowStock();
  };

  const closeSummary = () => {
    setStockSummary(null);
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Manage your spare parts inventory"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => { setShowUploadModal(true); setUploadFile(null); setUploadResult(null); setUploadStep("pick"); setColumnMapping({}); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Excel
            </button>
            <button
              onClick={openReorderModal}
              className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reorder
            </button>
            <button
              onClick={() => setShowStockModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <PackagePlus className="w-4 h-4" />
              Add Stock
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Part
            </button>
          </div>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search parts by name or part number..."
          />
        </div>
        <FilterDropdown
          value={category}
          onChange={setCategory}
          options={CATEGORIES}
          allLabel="All Categories"
        />
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm font-medium text-red-700">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Parts Table */}
      <PartsTable
        parts={parts}
        loading={loading}
        lowStockCount={lowStockParts.length}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAliasUpdate={async (partId, aliases) => {
          try {
            const res = await fetch(`/api/parts/${partId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ aliases }),
            });
            if (res.ok) {
              setParts((prev) => prev.map((p) => p.id === partId ? { ...p, aliases } : p));
              toast("Local names updated", "success");
            }
          } catch {
            toast("Failed to update local names", "error");
          }
        }}
        selectedIds={selectedIds}
        onSelectToggle={(id) =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          })
        }
        onSelectAll={() =>
          setSelectedIds((prev) => {
            const allIds = parts.map((p) => p.id);
            const allSelected = allIds.every((id) => prev.has(id));
            return allSelected ? new Set() : new Set(allIds);
          })
        }
      />

      {/* Add Part Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Part"
      >
        <PartForm onSubmit={handleAddSubmit} onCancel={() => setShowAddModal(false)} />
      </Modal>

      {/* Add Stock Modal */}
      <Modal
        open={showStockModal}
        onClose={() => setShowStockModal(false)}
        title="Add Stock Entry"
        wide
      >
        <AddStockForm
          parts={parts}
          onSuccess={handleStockSuccess}
          onCancel={() => setShowStockModal(false)}
        />
      </Modal>

      {/* Stock Summary Modal */}
      <Modal
        open={!!stockSummary}
        onClose={closeSummary}
        title="Stock Entry Summary"
        wide
      >
        {stockSummary && (
          <StockSummary
            summary={stockSummary.rows}
            message={stockSummary.message}
            onClose={closeSummary}
          />
        )}
      </Modal>

      {/* Edit Part Modal */}
      <Modal
        open={!!editPart}
        onClose={() => setEditPart(null)}
        title="Edit Part"
      >
        {editPart && (
          <PartForm
            initialData={{
              name: editPart.name,
              partNumber: editPart.partNumber,
              category: editPart.category,
              purchasePrice: editPart.purchasePrice,
              salePrice: editPart.salePrice,
              stock: editPart.stock,
              minStock: editPart.minStock,
              aliases: editPart.aliases || [],
            }}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditPart(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Part"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Reorder Suggestions Modal */}
      <Modal
        open={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        title="Reorder Suggestions"
        wide
      >
        {reorderLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        ) : reorderSuggestions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>All parts are well-stocked!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <strong>{reorderSuggestions.length}</strong> part{reorderSuggestions.length > 1 ? "s" : ""} need
              restocking. Estimated total cost:{" "}
              <strong>
                Rs {Math.round(reorderSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0)).toLocaleString()}
              </strong>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Part</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Stock</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Min</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Order Qty</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Last Vendor</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reorderSuggestions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.partNumber}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.stock === 0
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {s.stock}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500">{s.minStock}</td>
                      <td className="px-3 py-2 text-center font-bold text-blue-700">{s.suggestedQty}</td>
                      <td className="px-3 py-2 text-gray-600">{s.lastVendor ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        Rs {Math.round(s.lastPurchasePrice ?? s.purchasePrice).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        Rs {Math.round(s.estimatedCost).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setShowReorderModal(false)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </Modal>

      {/* Upload Excel/CSV Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={uploadStep === "pick" ? "Upload Inventory File" : uploadStep === "map" ? "Map Columns & Preview" : "Import Result"}
        wide
      >
        <div className="space-y-4">
          {/* STEP 1: File Picker */}
          {uploadStep === "pick" && (
            <>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Upload an Excel (.xlsx) or CSV (.csv) file</p>
                <p className="text-xs text-gray-400 mb-3">
                  You will be able to map columns in the next step
                </p>
                <div className="flex items-center justify-center gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Choose File
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                      }}
                    />
                  </label>
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {parts.length > 0 ? "Download Stock" : "Download Template"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {/* STEP 2: Column Mapping */}
          {uploadStep === "map" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-900 truncate">{uploadFile?.name}</span>
                <span className="text-xs text-blue-600 ml-auto flex-shrink-0">{uploadTotalRows} rows</span>
              </div>

              {/* Column Mapping Dropdowns */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Map your Excel columns to fields:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uploadHeaders.map((header) => (
                    <div key={header} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <span className="text-sm text-gray-700 font-medium min-w-0 truncate flex-1" title={header}>
                        {header}
                      </span>
                      <span className="text-gray-400 text-xs">→</span>
                      <select
                        value={columnMapping[header] || "skip"}
                        onChange={(e) => {
                          setColumnMapping((prev) => {
                            const next = { ...prev };
                            if (e.target.value === "skip") {
                              delete next[header];
                            } else {
                              next[header] = e.target.value;
                            }
                            return next;
                          });
                        }}
                        className={`text-sm border rounded-lg px-2 py-1.5 w-36 ${
                          columnMapping[header] ? "border-green-300 bg-green-50 text-green-800" : "border-gray-300 text-gray-400"
                        }`}
                      >
                        <option value="skip">— Skip —</option>
                        <option value="name">Name</option>
                        <option value="partNumber">Part Number</option>
                        <option value="category">Category</option>
                        <option value="purchasePrice">Purchase Price</option>
                        <option value="salePrice">Sale Price</option>
                        <option value="stock">Stock</option>
                        <option value="minStock">Min Stock</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mapped fields summary */}
              <div className="flex flex-wrap gap-1.5">
                {(["name", "partNumber", "purchasePrice", "salePrice", "stock", "category", "minStock"] as const).map((field) => {
                  const mapped = Object.values(columnMapping).includes(field);
                  const label = { name: "Name", partNumber: "Part No", purchasePrice: "Purchase Price", salePrice: "Sale Price", stock: "Stock", category: "Category", minStock: "Min Stock" }[field];
                  return (
                    <span
                      key={field}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        mapped ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {label} {mapped ? "✓" : "✗"}
                    </span>
                  );
                })}
              </div>

              {/* Preview Table showing raw data with current mapping */}
              {uploadSampleRows.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-xs font-medium text-gray-600 mb-1">Preview (first {uploadSampleRows.length} rows with current mapping):</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Name</th>
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Part No</th>
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Category</th>
                        <th className="text-right px-2 py-1.5 font-medium text-gray-600">Purchase</th>
                        <th className="text-right px-2 py-1.5 font-medium text-gray-600">Sale</th>
                        <th className="text-right px-2 py-1.5 font-medium text-gray-600">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {uploadSampleRows.map((rawRow, i) => {
                        // Apply current mapping to raw row
                        const mapped: Record<string, string> = {};
                        for (const [header, field] of Object.entries(columnMapping)) {
                          if (field !== "skip" && rawRow[header]) mapped[field] = rawRow[header];
                        }
                        return (
                          <tr key={i}>
                            <td className="px-2 py-1.5 font-medium text-gray-900">{mapped.name || <span className="text-gray-300">—</span>}</td>
                            <td className="px-2 py-1.5 text-gray-600">{mapped.partNumber && isNaN(Number(mapped.partNumber)) ? mapped.partNumber : <span className="text-gray-300 italic">auto</span>}</td>
                            <td className="px-2 py-1.5 text-gray-600">{mapped.category || <span className="text-gray-300">Other</span>}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600">{mapped.purchasePrice || <span className="text-gray-300">0</span>}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600">{mapped.salePrice || <span className="text-gray-300">0</span>}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600">{mapped.stock || <span className="text-gray-300">0</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setUploadStep("pick"); setUploadFile(null); }}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !Object.values(columnMapping).includes("name")}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {uploading ? "Importing..." : `Import ${uploadTotalRows} Parts`}
                </button>
              </div>
              {!Object.values(columnMapping).includes("name") && (
                <p className="text-xs text-red-500 text-center">Please map at least the Name column to proceed</p>
              )}
            </>
          )}

          {/* STEP 3: Result */}
          {uploadStep === "done" && uploadResult && (
            <>
              <div className={`rounded-lg p-4 ${uploadResult.created + uploadResult.updated > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {uploadResult.created + uploadResult.updated > 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-medium text-gray-900">
                    {uploadResult.created + uploadResult.updated > 0 ? "Import Complete" : "Import Failed"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-green-700">{uploadResult.created}</p>
                    <p className="text-xs text-gray-500">Created</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-700">{uploadResult.updated}</p>
                    <p className="text-xs text-gray-500">Updated</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-yellow-700">{uploadResult.skipped}</p>
                    <p className="text-xs text-gray-500">Skipped</p>
                  </div>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-1">Issues:</p>
                  <ul className="text-xs text-yellow-700 space-y-0.5">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => { setShowUploadModal(false); setUploadResult(null); setUploadFile(null); }}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
