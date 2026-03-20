"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Search, Upload, FileSpreadsheet, CheckCircle, XCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import IntegerInput from "@/components/IntegerInput";
import { fmtRs } from "@/lib/utils";

interface PurchaseItem {
  id: number;
  quantity: number;
  unitPrice: number;
  total: number;
  part: { name: string; partNumber: string };
}

interface Purchase {
  id: number;
  vendorId: number;
  vendor: { name: string };
  status: string;
  total: number;
  note: string | null;
  items: PurchaseItem[];
  createdAt: string;
}

interface Vendor {
  id: number;
  name: string;
}

interface Part {
  id: number;
  name: string;
  partNumber: string;
  purchasePrice: number;
}

interface FormItem {
  id: number;
  partId: string;
  quantity: string;
  unitPrice: string;
}

let itemId = 1;

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("received");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<FormItem[]>([
    { id: itemId++, partId: "", quantity: "", unitPrice: "" },
  ]);

  // Vendor form
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Upload (Bulk)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<"pick" | "map" | "done">("pick");
  const [uploadHeaders, setUploadHeaders] = useState<string[]>([]);
  const [uploadSampleRows, setUploadSampleRows] = useState<Record<string, string>[]>([]);
  const [uploadTotalRows, setUploadTotalRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploadVendorId, setUploadVendorId] = useState("");
  const [uploadStatus, setUploadStatus] = useState("received");
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    totalRows: number;
    purchasesCreated: number;
    itemsCreated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, vRes, partsRes] = await Promise.all([
        fetch("/api/purchases"), fetch("/api/vendors"), fetch("/api/parts"),
      ]);
      if (pRes.ok) {
        const pJson = await pRes.json();
        setPurchases(pJson.data ?? pJson);
      }
      if (vRes.ok) setVendors(await vRes.json());
      if (partsRes.ok) {
        const partsJson = await partsRes.json();
        setParts(partsJson.data ?? partsJson);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Upload helpers ──
  const PURCHASE_FIELDS = [
    { value: "partName", label: "Part Name" },
    { value: "partNumber", label: "Part Number" },
    { value: "quantity", label: "Quantity" },
    { value: "unitPrice", label: "Unit Price" },
    { value: "vendor", label: "Vendor" },
    { value: "skip", label: "— Skip —" },
  ];

  const downloadTemplate = () => {
    const templateData = parts.length > 0
      ? parts.slice(0, 5).map((p) => ({
          "Part Name": p.name,
          "Part Number": p.partNumber,
          "Quantity": 1,
          "Unit Price": p.purchasePrice,
        }))
      : [{
          "Part Name": "Oil Filter",
          "Part Number": "HON-OF-001",
          "Quantity": 10,
          "Unit Price": 150,
        }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchases");
    XLSX.writeFile(wb, "honda_purchases_template.xlsx");
  };

  const handleFileSelect = async (file: File) => {
    setUploadFile(file);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "preview");
      const res = await fetch("/api/purchases/upload", { method: "POST", body: formData });
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
      if (uploadVendorId) formData.append("vendorId", uploadVendorId);
      formData.append("status", uploadStatus);
      const res = await fetch("/api/purchases/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setUploadResult(data);
        setUploadStep("done");
        fetchAll();
      } else {
        setUploadResult({ success: false, totalRows: 0, purchasesCreated: 0, itemsCreated: 0, skipped: 0, errors: [data.error] });
        setUploadStep("done");
      }
    } catch {
      setUploadResult({ success: false, totalRows: 0, purchasesCreated: 0, itemsCreated: 0, skipped: 0, errors: ["Upload failed"] });
      setUploadStep("done");
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setShowUploadModal(true);
    setUploadFile(null);
    setUploadResult(null);
    setUploadStep("pick");
    setColumnMapping({});
    setUploadVendorId("");
    setUploadStatus("received");
  };

  function addItem() {
    setItems((prev) => [...prev, { id: itemId++, partId: "", quantity: "", unitPrice: "" }]);
  }
  function removeItem(id: number) {
    setItems((prev) => prev.length > 1 ? prev.filter((i) => i.id !== id) : prev);
  }
  function updateItem(id: number, field: string, value: string) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === "partId" && value) {
        const part = parts.find((p) => p.id === parseInt(value, 10));
        if (part) updated.unitPrice = String(part.purchasePrice);
      }
      return updated;
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!vendorId) return setError("Vendor is required");

    const validItems = items.filter((i) => i.partId && Number(i.quantity) > 0);
    if (validItems.length === 0) return setError("Add at least one item");

    setFormLoading(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: parseInt(vendorId, 10),
          status,
          note: note.trim() || undefined,
          items: validItems.map((i) => ({
            partId: parseInt(i.partId, 10),
            quantity: parseInt(i.quantity, 10),
            unitPrice: Math.round(parseFloat(i.unitPrice)),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowModal(false);
      setVendorId(""); setNote("");
      setItems([{ id: itemId++, partId: "", quantity: "", unitPrice: "" }]);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleAddVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorName.trim()) return;
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: vendorName.trim(), phone: vendorPhone.trim(), address: vendorAddress.trim() }),
      });
      if (res.ok) {
        const v = await res.json();
        setVendors((prev) => [...prev, v]);
        setVendorId(String(v.id));
        setShowVendorModal(false);
        setVendorName(""); setVendorPhone(""); setVendorAddress("");
      }
    } catch (err) { console.error(err); }
  }


  const statusColor: Record<string, string> = {
    received: "bg-green-100 text-green-700",
    in_transit: "bg-yellow-100 text-yellow-700",
    ordered: "bg-blue-100 text-blue-700",
  };
  const statusLabel: Record<string, string> = {
    received: "Received",
    in_transit: "In Transit",
    ordered: "Ordered",
  };

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchVendor = p.vendor.name.toLowerCase().includes(q);
        const matchItems = p.items.some((i) => i.part.name.toLowerCase().includes(q));
        const matchId = `PO${String(p.id).padStart(3, "0")}`.toLowerCase().includes(q);
        if (!matchVendor && !matchItems && !matchId) return false;
      }
      if (statusFilter && p.status !== statusFilter) return false;
      if (dateFrom && new Date(p.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(p.createdAt) > to) return false;
      }
      return true;
    });
  }, [purchases, searchQuery, statusFilter, dateFrom, dateTo]);

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Track purchase orders from suppliers"
        action={
          <div className="flex gap-2">
            <button
              onClick={resetUpload}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Excel
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Purchase
            </button>
          </div>
        }
      />

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by vendor, part, or PO ID..." className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">All Status</option>
          <option value="received">Received</option>
          <option value="in_transit">In Transit</option>
          <option value="ordered">Ordered</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">PO ID</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Supplier</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Items</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Total</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center">
                <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-gray-500">Loading...</p>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">{purchases.length > 0 ? "No purchases match filters" : "No purchases yet"}</td></tr>
            ) : (
              filtered.map((po) => (
                <tr key={po.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">PO{String(po.id).padStart(3, "0")}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{po.vendor.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{po.items.map((i) => `${i.part.name} x${i.quantity}`).join(", ")}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{fmtRs(po.total)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(po.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[po.status] || "bg-gray-100 text-gray-700"}`}>
                      {statusLabel[po.status] || po.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            {filtered.length} purchase(s) · Total: {fmtRs(filtered.reduce((s, p) => s + p.total, 0))}
          </div>
        )}
      </div>

      {/* New Purchase Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Purchase Order" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Supplier</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputClass}>
                <option value="">Select vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setShowVendorModal(true)} className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">+ New</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="received">Received</option>
              <option value="in_transit">In Transit</option>
              <option value="ordered">Ordered</option>
            </select>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <select value={item.partId} onChange={(e) => updateItem(item.id, "partId", e.target.value)} className="flex-1 px-2 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Select Part</option>
                    {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <IntegerInput value={item.quantity} onChange={(v) => updateItem(item.id, "quantity", v)} className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Qty" />
                  <IntegerInput value={item.unitPrice} onChange={(v) => updateItem(item.id, "unitPrice", v)} className="w-28 px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Price" />
                  <button type="button" onClick={() => removeItem(item.id)} className="px-2 text-gray-400 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium">+ Add Item</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </div>

          {items.some((i) => i.partId && Number(i.quantity) > 0) && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-right">
              <span className="text-sm text-gray-600">Total: </span>
              <span className="text-lg font-bold text-gray-900">
                {fmtRs(items.reduce((s, i) => s + (parseInt(i.quantity, 10) || 0) * Math.round(parseFloat(i.unitPrice) || 0), 0))}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {formLoading ? "Processing..." : "Create Purchase"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Vendor Modal */}
      <Modal open={showVendorModal} onClose={() => setShowVendorModal(false)} title="Add Vendor">
        <form onSubmit={handleAddVendor} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
            <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={inputClass} placeholder="e.g. Honda Pakistan" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="text" value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowVendorModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Add Vendor</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="Bulk Purchase Upload" wide>
        {uploadStep === "pick" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload an Excel or CSV file with purchase items. The file should contain columns for Part Name, Quantity, and Unit Price.
            </p>

            {/* Template download */}
            <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Download className="w-4 h-4" /> Download Template
            </button>

            {/* Vendor & Status for the import */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Vendor</label>
                <select value={uploadVendorId} onChange={(e) => setUploadVendorId(e.target.value)} className={inputClass}>
                  <option value="">From file (or select)</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">If file has a Vendor column, it will be used instead</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={uploadStatus} onChange={(e) => setUploadStatus(e.target.value)} className={inputClass}>
                  <option value="received">Received (update stock)</option>
                  <option value="in_transit">In Transit</option>
                  <option value="ordered">Ordered</option>
                </select>
              </div>
            </div>

            {/* File drop zone */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files[0];
                if (f) handleFileSelect(f);
              }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".xlsx,.xls,.csv";
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleFileSelect(f);
                };
                input.click();
              }}
            >
              <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">Drop Excel/CSV file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</p>
            </div>
          </div>
        )}

        {uploadStep === "map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Map Columns</p>
                <p className="text-xs text-gray-500">{uploadTotalRows} row(s) found in <span className="font-medium">{uploadFile?.name}</span></p>
              </div>
              <button onClick={() => setUploadStep("pick")} className="text-xs text-gray-500 hover:text-gray-700">← Back</button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Excel Column</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Maps To</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Sample Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {uploadHeaders.map((header) => (
                    <tr key={header}>
                      <td className="px-3 py-2 font-mono text-gray-700">{header}</td>
                      <td className="px-3 py-2">
                        <select
                          value={columnMapping[header] || "skip"}
                          onChange={(e) => setColumnMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                          className={`px-2 py-1 border rounded text-xs ${
                            columnMapping[header] && columnMapping[header] !== "skip"
                              ? "border-green-300 bg-green-50 text-green-700"
                              : "border-gray-200"
                          }`}
                        >
                          {PURCHASE_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                        {uploadSampleRows.slice(0, 3).map((r) => r[header]).filter(Boolean).join(" | ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!uploadVendorId && !Object.values(columnMapping).includes("vendor") && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
                ⚠️ No vendor column mapped and no default vendor selected. Go back to select a vendor or map a vendor column.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setUploadStep("pick")} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Back</button>
              <button
                onClick={handleUpload}
                disabled={uploading || !Object.values(columnMapping).includes("partName")}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Processing..." : `Import ${uploadTotalRows} Rows`}
              </button>
            </div>
          </div>
        )}

        {uploadStep === "done" && uploadResult && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-lg ${uploadResult.success ? "bg-green-50" : "bg-red-50"}`}>
              {uploadResult.success
                ? <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                : <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
              }
              <div>
                <p className={`text-sm font-medium ${uploadResult.success ? "text-green-800" : "text-red-800"}`}>
                  {uploadResult.success ? "Import Complete!" : "Import Failed"}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {uploadResult.purchasesCreated} purchase(s) created · {uploadResult.itemsCreated} item(s) added · {uploadResult.skipped} skipped
                </p>
              </div>
            </div>

            {uploadResult.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-[150px] overflow-y-auto">
                <p className="text-xs font-medium text-yellow-800 mb-1">Warnings:</p>
                {uploadResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-yellow-700">{err}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
              <button onClick={resetUpload} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Upload Another</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
