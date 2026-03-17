"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, RefreshCw, Pencil, CheckCircle, Bike } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface JobCard {
  id: number;
  jobCardNumber: string;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string;
  meterReading: number;
  bikeModel: string;
  mechanicName: string;
  laborCost: number;
  status: string;
  sales: { id: number; total: number }[];
  createdAt: string;
  updatedAt: string;
}

const BIKE_MODELS = [
  "CD-70", "CD-70 Dream", "CG-125", "CG-125S", "CG-125 Self",
  "CB-125F", "CB-150F", "CB-150F SE", "Deluxe", "Pridor",
  "Navi", "CB-250F", "Other",
];

export default function JobCardsPage() {
  const { toast } = useToast();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCard, setEditCard] = useState<JobCard | null>(null);
  const [completeTarget, setCompleteTarget] = useState<JobCard | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [meterReading, setMeterReading] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [laborCost, setLaborCost] = useState("");

  const fetchJobCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/job-cards");
      if (res.ok) setJobCards(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobCards(); }, [fetchJobCards]);

  const filtered = useMemo(() => {
    return jobCards.filter((jc) => {
      if (statusFilter && jc.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          jc.jobCardNumber.toLowerCase().includes(q) ||
          jc.customerName.toLowerCase().includes(q) ||
          jc.customerPhone.includes(q) ||
          jc.vehicleNumber.toLowerCase().includes(q) ||
          jc.bikeModel.toLowerCase().includes(q) ||
          jc.mechanicName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobCards, searchQuery, statusFilter]);

  function resetForm() {
    setCustomerName(""); setCustomerPhone(""); setVehicleNumber("");
    setMeterReading(""); setBikeModel(""); setMechanicName(""); setLaborCost("");
    setError("");
  }

  function openEdit(jc: JobCard) {
    setEditCard(jc);
    setCustomerName(jc.customerName);
    setCustomerPhone(jc.customerPhone);
    setVehicleNumber(jc.vehicleNumber);
    setMeterReading(String(jc.meterReading));
    setBikeModel(jc.bikeModel);
    setMechanicName(jc.mechanicName);
    setLaborCost(String(jc.laborCost));
    setError("");
    setShowModal(true);
  }

  const nextCardNumber = useMemo(() => {
    if (jobCards.length === 0) return "01";
    const maxNum = Math.max(...jobCards.map((jc) => parseInt(jc.jobCardNumber, 10) || 0));
    return String(maxNum + 1).padStart(2, "0");
  }, [jobCards]);

  function openNew() {
    setEditCard(null);
    resetForm();
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) return setError("Customer name is required");
    if (!customerPhone.trim()) return setError("Phone is required");
    if (!vehicleNumber.trim()) return setError("Vehicle number is required");
    if (!bikeModel.trim()) return setError("Bike model is required");
    if (!mechanicName.trim()) return setError("Mechanic name is required");
    if (!meterReading || parseInt(meterReading, 10) < 0) return setError("Valid meter reading is required");

    setFormLoading(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        vehicleNumber: vehicleNumber.trim(),
        meterReading: parseInt(meterReading, 10),
        bikeModel: bikeModel.trim(),
        mechanicName: mechanicName.trim(),
        laborCost: Math.round(parseFloat(laborCost) || 0),
      };

      const url = editCard ? `/api/job-cards/${editCard.id}` : "/api/job-cards";
      const method = editCard ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast(editCard ? "Job card updated" : `Job card ${data.jobCardNumber} created`, "success");
      setShowModal(false);
      resetForm();
      setEditCard(null);
      fetchJobCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save job card");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleComplete() {
    if (!completeTarget) return;
    try {
      const res = await fetch(`/api/job-cards/${completeTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        toast(`${completeTarget.jobCardNumber} marked as completed`, "success");
        fetchJobCards();
      }
    } catch (err) { console.error(err); }
    setCompleteTarget(null);
  }

  const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
  const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white transition-shadow placeholder:text-gray-400";

  return (
    <>
      <PageHeader
        title="Job Cards"
        description="Manage service job cards for incoming bikes"
        action={
          <button onClick={openNew} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Job Card
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, phone, vehicle, mechanic..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase">Total</p>
          <p className="text-2xl font-bold text-gray-900">{jobCards.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase">Open</p>
          <p className="text-2xl font-bold text-yellow-600">{jobCards.filter((j) => j.status === "open").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase">Completed</p>
          <p className="text-2xl font-bold text-green-600">{jobCards.filter((j) => j.status === "completed").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase">Today</p>
          <p className="text-2xl font-bold text-red-600">
            {jobCards.filter((j) => new Date(j.createdAt).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Job Card #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Customer</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Vehicle</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Bike</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Mechanic</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Labor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center">
                  <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center">
                  <Bike className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">{jobCards.length > 0 ? "No job cards match your filters" : "No job cards yet"}</p>
                  <p className="text-xs text-gray-400 mt-1">Create your first job card to get started</p>
                </td></tr>
              ) : (
                filtered.map((jc) => (
                  <tr key={jc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-medium text-red-600">{jc.jobCardNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{jc.customerName}</div>
                      <div className="text-xs text-gray-500">{jc.customerPhone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-mono">{jc.vehicleNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{jc.bikeModel}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{jc.mechanicName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{fmtRs(jc.laborCost)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        jc.status === "open" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                      }`}>
                        {jc.status === "open" ? "Open" : "Completed"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(jc.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(jc)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {jc.status === "open" && (
                          <button onClick={() => setCompleteTarget(jc)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Mark Complete">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            {filtered.length} job card(s)
          </div>
        )}
      </div>

      {/* Complete Confirm */}
      <ConfirmDialog
        open={!!completeTarget}
        onCancel={() => setCompleteTarget(null)}
        onConfirm={handleComplete}
        title="Mark as Completed"
        message={`Mark ${completeTarget?.jobCardNumber} as completed? This means the service work is done.`}
        confirmLabel="Complete"
      />

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditCard(null); resetForm(); }} title={editCard ? `Edit Job Card #${editCard.jobCardNumber}` : `New Job Card #${nextCardNumber}`} wide>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg font-medium">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Customer Name <span className="text-red-500">*</span></label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} placeholder="e.g. Ali Khan" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone <span className="text-red-500">*</span></label>
              <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} placeholder="03XX-XXXXXXX" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Vehicle Number <span className="text-red-500">*</span></label>
              <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className={inputClass} placeholder="LEA-1234" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Meter Reading (km) <span className="text-red-500">*</span></label>
              <input type="number" value={meterReading} onChange={(e) => setMeterReading(e.target.value)} className={inputClass} placeholder="12000" min="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bike Model <span className="text-red-500">*</span></label>
              <select value={bikeModel} onChange={(e) => setBikeModel(e.target.value)} className={`${inputClass} cursor-pointer`}>
                <option value="">Select Model</option>
                {BIKE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mechanic Name <span className="text-red-500">*</span></label>
              <input type="text" value={mechanicName} onChange={(e) => setMechanicName(e.target.value)} className={inputClass} placeholder="e.g. Usman" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Labor Cost (Rs)</label>
              <input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} className={inputClass} placeholder="0" min="0" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => { setShowModal(false); setEditCard(null); resetForm(); }} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={formLoading} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
              {formLoading ? "Saving..." : editCard ? "Update Job Card" : "Create Job Card"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
