"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, vRes, partsRes] = await Promise.all([
        fetch("/api/purchases"), fetch("/api/vendors"), fetch("/api/parts"),
      ]);
      if (pRes.ok) setPurchases(await pRes.json());
      if (vRes.ok) setVendors(await vRes.json());
      if (partsRes.ok) setParts(await partsRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
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
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Purchase
          </button>
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
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Qty" min="1" />
                  <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)} className="w-28 px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Price" min="0" step="0.01" />
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
    </>
  );
}
