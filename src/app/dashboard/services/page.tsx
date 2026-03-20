"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import IntegerInput from "@/components/IntegerInput";
import { fmtRs } from "@/lib/utils";

interface ServiceRecord {
  id: number;
  customerName: string;
  customerPhone: string | null;
  bikeModel: string;
  bikeRegNo: string | null;
  serviceType: string;
  status: string;
  laborCost: number;
  total: number;
  note: string | null;
  items: { id: number; quantity: number; unitPrice: number; total: number; part: { name: string } }[];
  createdAt: string;
}

interface Part {
  id: number;
  name: string;
  salePrice: number;
  stock: number;
}

interface FormItem {
  id: number;
  partId: string;
  quantity: string;
  unitPrice: string;
}

let itemId = 1;

const BIKE_MODELS = ["Honda CD 70", "Honda CG 125", "Honda CB 150F", "Honda Pridor", "Honda CB 125F", "Honda CB 250F", "Other"];
const SERVICE_TYPES = ["Oil Change", "Engine Tune-up", "Brake Service", "Chain Adjustment", "Full Service", "Clutch Replacement", "Electrical Repair", "Body Work", "Other"];

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [bikeRegNo, setBikeRegNo] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<FormItem[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([fetch("/api/services"), fetch("/api/parts")]);
      if (sRes.ok) {
        const sJson = await sRes.json();
        setServices(sJson.data ?? sJson);
      }
      if (pRes.ok) {
        const pJson = await pRes.json();
        setParts(pJson.data ?? pJson);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function addItem() { setItems((prev) => [...prev, { id: itemId++, partId: "", quantity: "", unitPrice: "" }]); }
  function removeItem(id: number) { setItems((prev) => prev.filter((i) => i.id !== id)); }
  function updateItem(id: number, field: string, value: string) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === "partId" && value) {
        const p = parts.find((pt) => pt.id === parseInt(value, 10));
        if (p) updated.unitPrice = String(p.salePrice);
      }
      return updated;
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!customerName.trim()) return setError("Customer name is required");
    if (!bikeModel) return setError("Bike model is required");
    if (!serviceType) return setError("Service type is required");

    setFormLoading(true);
    try {
      const validItems = items.filter((i) => i.partId && Number(i.quantity) > 0);
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          bikeModel,
          bikeRegNo: bikeRegNo.trim() || undefined,
          serviceType,
          laborCost: Math.round(parseFloat(laborCost) || 0),
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
      resetForm();
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setFormLoading(false);
    }
  }

  function resetForm() {
    setCustomerName(""); setCustomerPhone(""); setBikeModel(""); setBikeRegNo("");
    setServiceType(""); setLaborCost(""); setNote(""); setItems([]);
  }

  async function updateStatus(id: number, newStatus: string) {
    try {
      await fetch(`/api/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAll();
    } catch (err) { console.error(err); }
  }


  const statusColor: Record<string, string> = {
    pending: "bg-red-100 text-red-700",
    in_progress: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
  };
  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = s.customerName.toLowerCase().includes(q);
        const matchBike = s.bikeModel.toLowerCase().includes(q);
        const matchType = s.serviceType.toLowerCase().includes(q);
        const matchId = `SV${String(s.id).padStart(3, "0")}`.toLowerCase().includes(q);
        if (!matchName && !matchBike && !matchType && !matchId) return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      if (dateFrom && new Date(s.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(s.createdAt) > to) return false;
      }
      return true;
    });
  }, [services, searchQuery, statusFilter, dateFrom, dateTo]);

  return (
    <>
      <PageHeader
        title="Services"
        description="Manage bike service records"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Service
          </button>
        }
      />

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by customer, bike, or service..." className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">ID</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Bike</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Customer</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Service</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Cost</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center">
                <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-gray-500">Loading...</p>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">{services.length > 0 ? "No services match filters" : "No services yet"}</td></tr>
            ) : (
              filtered.map((svc) => (
                <tr key={svc.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">SV{String(svc.id).padStart(3, "0")}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{svc.bikeModel}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{svc.customerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{svc.serviceType}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{fmtRs(svc.total)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(svc.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <select
                      value={svc.status}
                      onChange={(e) => updateStatus(svc.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${statusColor[svc.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            {filtered.length} service(s) · Total: {fmtRs(filtered.reduce((s, sv) => s + sv.total, 0))}
          </div>
        )}
      </div>

      {/* New Service Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Service" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
              <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bike Model</label>
              <select value={bikeModel} onChange={(e) => setBikeModel(e.target.value)} className={inputClass}>
                <option value="">Select model</option>
                {BIKE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reg No (optional)</label>
              <input type="text" value={bikeRegNo} onChange={(e) => setBikeRegNo(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={inputClass}>
                <option value="">Select type</option>
                {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Labor Cost (Rs)</label>
              <IntegerInput value={laborCost} onChange={setLaborCost} className={inputClass} />
            </div>
          </div>

          {/* Parts Used */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Parts Used (optional)</label>
              <button type="button" onClick={addItem} className="text-sm text-red-600 hover:text-red-700 font-medium">+ Add Part</button>
            </div>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2">
                    <select value={item.partId} onChange={(e) => updateItem(item.id, "partId", e.target.value)} className="flex-1 px-2 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">Select Part</option>
                      {parts.filter((p) => p.stock > 0).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                      ))}
                    </select>
                    <IntegerInput value={item.quantity} onChange={(v) => updateItem(item.id, "quantity", v)} className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Qty" />
                    <IntegerInput value={item.unitPrice} onChange={(v) => updateItem(item.id, "unitPrice", v)} className="w-28 px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Price" />
                    <button type="button" onClick={() => removeItem(item.id)} className="px-2 text-gray-400 hover:text-red-500">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </div>

          {/* Total preview */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-right">
            <span className="text-sm text-gray-600">Total: </span>
            <span className="text-lg font-bold text-gray-900">
              {fmtRs(
                Math.round(parseFloat(laborCost) || 0) +
                items.reduce((s, i) => s + (parseInt(i.quantity, 10) || 0) * Math.round(parseFloat(i.unitPrice) || 0), 0)
              )}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {formLoading ? "Processing..." : "Create Service"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
