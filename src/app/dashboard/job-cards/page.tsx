"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Search, RefreshCw, Pencil, CheckCircle, Bike, X, UserPlus, Users, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import IntegerInput from "@/components/IntegerInput";
import { fmtRs } from "@/lib/utils";
import { BIKE_MODELS, inputClassFull as inputClass } from "@/lib/constants";

interface StaffMember {
  id: number;
  name: string;
  role: string;
  contact?: string;
  status: string;
}

interface StaffAssignment {
  staffId: number;
  staffName: string;
  staffRole: string;
  labourType: string;
  hoursSpent: string;
}

interface JobCardStaffAssignment {
  id: number;
  staffId: number;
  labourType: string | null;
  hoursSpent: number | null;
  staff: { id: number; name: string; role: string; bonusConfig?: { minJobcardAmount: number; bonusValue: number; active: boolean } | null };
}

interface JobCard {
  id: number;
  jobCardNumber: string;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string;
  meterReading: number;
  bikeModel: string;
  laborCost: number;
  status: string;
  sales: { id: number; total: number; status: string }[];
  staffAssignments: JobCardStaffAssignment[];
  createdAt: string;
  updatedAt: string;
}

const LABOUR_TYPES = [
  "Engine Tuning", "Garage Set", "Oil Change", "Chain Adjustment",
  "Brake Service", "Electrical Work", "Body Work", "Wheel Balancing", "General Service", "Other",
];

const ROLE_LABELS: Record<string, string> = {
  job_card_person: "Job Card",
  mechanic: "Mechanic",
  store_keeper: "Store Keeper",
  wheel_balancer: "Wheel Balancer",
  admin: "Admin",
};

export default function JobCardsPage() {
  const { toast } = useToast();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCard, setEditCard] = useState<JobCard | null>(null);
  const [completeTarget, setCompleteTarget] = useState<JobCard | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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
  const [laborCost, setLaborCost] = useState("");

  // Staff assignment state
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const staffDropdownRef = useRef<HTMLDivElement>(null);

  // Quick Add Staff modal
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("mechanic");
  const [newStaffContact, setNewStaffContact] = useState("");
  const [addStaffLoading, setAddStaffLoading] = useState(false);

  const fetchJobCards = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/job-cards", { signal });
      if (res.ok) {
        const json = await res.json();
        setJobCards(json.data ?? json);
      }
    } catch (err) { if (err instanceof Error && err.name === "AbortError") return; console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchStaff = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/staff?status=active", { signal });
      if (res.ok) setAllStaff(await res.json());
    } catch (err) { if (err instanceof Error && err.name === "AbortError") return; console.error(err); }
  }, []);

  useEffect(() => { const c = new AbortController(); fetchJobCards(c.signal); fetchStaff(c.signal); return () => c.abort(); }, [fetchJobCards, fetchStaff]);

  // Close staff dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(e.target as Node)) {
        setStaffDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredStaffOptions = useMemo(() => {
    const assignedIds = new Set(staffAssignments.map((a) => a.staffId));
    return allStaff.filter((s) => {
      if (assignedIds.has(s.id)) return false;
      if (staffSearch) {
        const q = staffSearch.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allStaff, staffAssignments, staffSearch]);

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
          jc.bikeModel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobCards, searchQuery, statusFilter]);

  function resetForm() {
    setCustomerName(""); setCustomerPhone(""); setVehicleNumber("");
    setMeterReading(""); setBikeModel(""); setLaborCost("");
    setStaffAssignments([]); setStaffSearch(""); setStaffDropdownOpen(false);
    setError("");
  }

  function openEdit(jc: JobCard) {
    setEditCard(jc);
    setCustomerName(jc.customerName);
    setCustomerPhone(jc.customerPhone);
    setVehicleNumber(jc.vehicleNumber);
    setMeterReading(String(jc.meterReading));
    setBikeModel(jc.bikeModel);
    setLaborCost(String(jc.laborCost));
    setStaffAssignments(
      (jc.staffAssignments || []).map((sa) => ({
        staffId: sa.staff.id,
        staffName: sa.staff.name,
        staffRole: sa.staff.role,
        labourType: sa.labourType || "",
        hoursSpent: sa.hoursSpent != null ? String(sa.hoursSpent) : "",
      }))
    );
    setStaffSearch(""); setStaffDropdownOpen(false);
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

  function addStaffAssignment(staff: StaffMember) {
    if (staffAssignments.some((a) => a.staffId === staff.id)) return;
    setStaffAssignments((prev) => [
      ...prev,
      { staffId: staff.id, staffName: staff.name, staffRole: staff.role, labourType: "", hoursSpent: "" },
    ]);
    setStaffSearch("");
    setStaffDropdownOpen(false);
  }

  function removeStaffAssignment(staffId: number) {
    setStaffAssignments((prev) => prev.filter((a) => a.staffId !== staffId));
  }

  function updateAssignment(staffId: number, field: "labourType" | "hoursSpent", value: string) {
    setStaffAssignments((prev) =>
      prev.map((a) => (a.staffId === staffId ? { ...a, [field]: value } : a))
    );
  }

  async function handleQuickAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    setAddStaffLoading(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStaffName.trim(), role: newStaffRole, contact: newStaffContact.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchStaff();
      addStaffAssignment({ id: data.id, name: data.name, role: data.role, status: "active" });
      setShowAddStaff(false);
      setNewStaffName(""); setNewStaffRole("mechanic"); setNewStaffContact("");
      toast(`Staff "${data.name}" created & assigned`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create staff", "error");
    } finally {
      setAddStaffLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) return setError("Customer name is required");
    if (!customerPhone.trim()) return setError("Phone is required");
    if (!vehicleNumber.trim()) return setError("Vehicle number is required");
    if (!bikeModel.trim()) return setError("Bike model is required");
    if (!meterReading || parseInt(meterReading, 10) < 0) return setError("Valid meter reading is required");
    if (staffAssignments.length === 0) return setError("At least one staff must be assigned");

    setFormLoading(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        vehicleNumber: vehicleNumber.trim(),
        meterReading: parseInt(meterReading, 10),
        bikeModel: bikeModel.trim(),
        laborCost: Math.round(parseFloat(laborCost) || 0),
        staffAssignments: staffAssignments.map((a) => ({
          staffId: a.staffId,
          labourType: a.labourType || null,
          hoursSpent: a.hoursSpent ? parseFloat(a.hoursSpent) : null,
        })),
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
    setActionLoading(true);
    try {
      const payload = {
        customerName: completeTarget.customerName,
        customerPhone: completeTarget.customerPhone,
        vehicleNumber: completeTarget.vehicleNumber,
        meterReading: completeTarget.meterReading,
        bikeModel: completeTarget.bikeModel,
        laborCost: completeTarget.laborCost,
        staffAssignments: completeTarget.staffAssignments.map((a) => ({
          staffId: a.staffId,
          labourType: a.labourType || null,
          hoursSpent: a.hoursSpent != null ? a.hoursSpent : null,
        })),
        status: "completed",
      };
      const res = await fetch(`/api/job-cards/${completeTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast(`${completeTarget.jobCardNumber} marked as completed`, "success");
        fetchJobCards();
      }
    } catch (err) { console.error(err); }
    setCompleteTarget(null);
    setActionLoading(false);
  }


  function getJobCardTotal(jc: JobCard) {
    const salesTotal = jc.sales.reduce((sum, s) => sum + s.total, 0);
    return jc.laborCost + salesTotal;
  }

  function getRowHighlight(jc: JobCard): { bg: string; label: string | null } {
    const total = getJobCardTotal(jc);
    // Find the highest bonus threshold among assigned staff
    let maxThreshold = 0;
    for (const sa of jc.staffAssignments) {
      const cfg = sa.staff.bonusConfig;
      if (cfg?.active && cfg.minJobcardAmount > maxThreshold) {
        maxThreshold = cfg.minJobcardAmount;
      }
    }
    if (maxThreshold === 0) return { bg: "", label: null }; // No bonus config
    if (total >= maxThreshold) return { bg: "", label: null }; // Meets threshold — normal
    if (total >= 1500) return { bg: "bg-yellow-50", label: `Below bonus threshold (${fmtRs(maxThreshold)})` };
    return { bg: "bg-red-50", label: `Low value — far below threshold (${fmtRs(maxThreshold)})` };
  }

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
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, phone, vehicle..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow" />
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Assigned Staff</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-3">Total</th>
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
                filtered.map((jc) => {
                  const highlight = getRowHighlight(jc);
                  const total = getJobCardTotal(jc);
                  return (
                  <tr key={jc.id} className={`border-b border-gray-100 hover:bg-gray-50 ${highlight.bg}`} title={highlight.label || undefined}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {highlight.label && <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${highlight.bg === 'bg-red-50' ? 'text-red-500' : 'text-yellow-500'}`} />}
                        <span className="text-sm font-mono font-medium text-red-600">{jc.jobCardNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{jc.customerName}</div>
                      <div className="text-xs text-gray-500">{jc.customerPhone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-mono">{jc.vehicleNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{jc.bikeModel}</td>
                    <td className="px-6 py-4">
                      {jc.staffAssignments && jc.staffAssignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {jc.staffAssignments.map((sa) => (
                            <span key={sa.id} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700" title={sa.labourType || undefined}>
                              {sa.staff.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-gray-900">{fmtRs(total)}</span>
                      {highlight.label && (
                        <div className={`text-[10px] font-medium mt-0.5 ${highlight.bg === 'bg-red-50' ? 'text-red-500' : 'text-yellow-600'}`}>
                          {highlight.bg === 'bg-red-50' ? 'Low value' : 'Below threshold'}
                        </div>
                      )}
                    </td>
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
                  );
                })
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
        loading={actionLoading}
        title="Mark as Completed"
        message={(() => {
          if (!completeTarget) return "";
          const hasFinalSale = completeTarget.sales.some((s) => s.status === "final");
          const hasDraftSale = completeTarget.sales.some((s) => s.status === "draft");
          const noSales = completeTarget.sales.length === 0;
          if (noSales) return `⚠️ WARNING: No invoice has been created for ${completeTarget.jobCardNumber}. Payment has not been recorded. Are you sure you want to mark it as completed?`;
          if (!hasFinalSale && hasDraftSale) return `⚠️ WARNING: ${completeTarget.jobCardNumber} has draft invoice(s) that haven't been finalized. Payment has not been confirmed. Are you sure you want to complete?`;
          return `Mark ${completeTarget.jobCardNumber} as completed? This means the service work is done.`;
        })()}
        confirmLabel={completeTarget && !completeTarget.sales.some((s) => s.status === "final") ? "Complete Anyway" : "Complete"}
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
              <IntegerInput value={meterReading} onChange={setMeterReading} className={inputClass} placeholder="12000" />
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Labor Cost (Rs)</label>
              <IntegerInput value={laborCost} onChange={setLaborCost} className={inputClass} placeholder="0" />
            </div>
          </div>

          {/* Staff Assignment Section */}
          <div className="border-t border-gray-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Users className="w-4 h-4" /> Assign Staff <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => { setShowAddStaff(true); setNewStaffName(staffSearch || ""); }}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add New Staff
              </button>
            </div>

            {/* Staff search dropdown */}
            <div ref={staffDropdownRef} className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => { setStaffSearch(e.target.value); setStaffDropdownOpen(true); }}
                onFocus={() => setStaffDropdownOpen(true)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                placeholder="Search staff by name or role..."
              />
              {staffDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredStaffOptions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      No staff found.{" "}
                      <button type="button" onClick={() => { setShowAddStaff(true); setNewStaffName(staffSearch); }} className="text-red-600 hover:underline font-medium">
                        Add new staff
                      </button>
                    </div>
                  ) : (
                    filteredStaffOptions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addStaffAssignment(s)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-gray-900">{s.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{ROLE_LABELS[s.role] || s.role}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Assigned staff list */}
            {staffAssignments.length > 0 && (
              <div className="space-y-2">
                {staffAssignments.map((a) => (
                  <div key={a.staffId} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 shrink-0">
                      <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {a.staffName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 block truncate">{a.staffName}</span>
                        <span className="text-xs text-gray-500">{ROLE_LABELS[a.staffRole] || a.staffRole}</span>
                      </div>
                    </div>
                    <select
                      value={a.labourType}
                      onChange={(e) => updateAssignment(a.staffId, "labourType", e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                    >
                      <option value="">Labour type (optional)</option>
                      {LABOUR_TYPES.map((lt) => <option key={lt} value={lt}>{lt}</option>)}
                    </select>
                    <IntegerInput
                      value={a.hoursSpent}
                      onChange={(v) => updateAssignment(a.staffId, "hoursSpent", v)}
                      className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      placeholder="Hours"
                    />
                    <button type="button" onClick={() => removeStaffAssignment(a.staffId)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {staffAssignments.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Search and select staff members to assign to this job card</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => { setShowModal(false); setEditCard(null); resetForm(); }} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={formLoading} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
              {formLoading ? "Saving..." : editCard ? "Update Job Card" : "Create Job Card"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Staff Modal */}
      <Modal open={showAddStaff} onClose={() => setShowAddStaff(false)} title="Quick Add Staff">
        <form onSubmit={handleQuickAddStaff} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className={inputClass} placeholder="Staff name" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
            <select value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value)} className={`${inputClass} cursor-pointer`}>
              <option value="mechanic">Mechanic</option>
              <option value="job_card_person">Job Card Person</option>
              <option value="store_keeper">Store Keeper</option>
              <option value="wheel_balancer">Wheel Balancer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact</label>
            <input type="text" value={newStaffContact} onChange={(e) => setNewStaffContact(e.target.value)} className={inputClass} placeholder="Phone (optional)" />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setShowAddStaff(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={addStaffLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {addStaffLoading ? "Adding..." : "Add & Assign"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
