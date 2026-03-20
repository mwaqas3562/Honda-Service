"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Trash2, Search, RefreshCw, UserPlus, X, Check, Users, Trophy, Settings, Eye } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import IntegerInput from "@/components/IntegerInput";
import { fmtRs } from "@/lib/utils";
import Link from "next/link";

interface BonusConfig {
  id: number;
  staffId: number;
  minJobcardAmount: number;
  bonusType: string;
  bonusValue: number;
  active: boolean;
}

interface Staff {
  id: number;
  name: string;
  role: string;
  contact: string | null;
  status: string;
  baseSalary: number;
  bonusConfig: BonusConfig | null;
  createdAt: string;
}

const ROLES = [
  { value: "job_card_person", label: "Job Card Person" },
  { value: "mechanic", label: "Mechanic" },
  { value: "store_keeper", label: "Store Keeper" },
  { value: "wheel_balancer", label: "Wheel Balancer" },
  { value: "admin", label: "Admin" },
];

const ROLE_LABELS: Record<string, string> = {
  job_card_person: "Job Card Person",
  mechanic: "Mechanic",
  store_keeper: "Store Keeper",
  wheel_balancer: "Wheel Balancer",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  job_card_person: "bg-blue-100 text-blue-700",
  mechanic: "bg-purple-100 text-purple-700",
  store_keeper: "bg-orange-100 text-orange-700",
  wheel_balancer: "bg-teal-100 text-teal-700",
  admin: "bg-red-100 text-red-700",
};

export default function StaffPage() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("mechanic");
  const [formContact, setFormContact] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formBaseSalary, setFormBaseSalary] = useState("");
  const [formError, setFormError] = useState("");

  // Bonus config modal state
  const [bonusTarget, setBonusTarget] = useState<Staff | null>(null);
  const [bonusMinAmount, setBonusMinAmount] = useState("");
  const [bonusValue, setBonusValue] = useState("");
  const [bonusActive, setBonusActive] = useState(true);
  const [bonusSaving, setBonusSaving] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/staff?${params.toString()}`);
      if (res.ok) setStaff(await res.json());
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, statusFilter]);

  // Debounce search input
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const resetForm = () => {
    setFormName("");
    setFormRole("mechanic");
    setFormContact("");
    setFormStatus("active");
    setFormBaseSalary("");
    setFormError("");
    setEditingStaff(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (s: Staff) => {
    setEditingStaff(s);
    setFormName(s.name);
    setFormRole(s.role);
    setFormContact(s.contact || "");
    setFormStatus(s.status);
    setFormBaseSalary(String(s.baseSalary || 0));
    setFormError("");
    setShowForm(true);
  };

  const openBonusConfig = (s: Staff) => {
    setBonusTarget(s);
    if (s.bonusConfig) {
      setBonusMinAmount(String(s.bonusConfig.minJobcardAmount));
      setBonusValue(String(s.bonusConfig.bonusValue));
      setBonusActive(s.bonusConfig.active);
    } else {
      setBonusMinAmount("3000");
      setBonusValue("5");
      setBonusActive(true);
    }
  };

  const handleBonusSave = async () => {
    if (!bonusTarget) return;
    if (!bonusMinAmount || Number(bonusMinAmount) < 0) {
      toast("Min amount must be >= 0", "error");
      return;
    }
    if (!bonusValue || Number(bonusValue) <= 0 || Number(bonusValue) > 100) {
      toast("Bonus percentage must be between 0 and 100", "error");
      return;
    }
    setBonusSaving(true);
    try {
      const res = await fetch(`/api/staff/${bonusTarget.id}/bonus-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minJobcardAmount: Number(bonusMinAmount),
          bonusType: "percentage",
          bonusValue: Number(bonusValue),
          active: bonusActive,
        }),
      });
      if (res.ok) {
        toast(`Bonus config saved for ${bonusTarget.name}`, "success");
        setBonusTarget(null);
        fetchStaff();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save", "error");
      }
    } catch {
      toast("Failed to save bonus config", "error");
    } finally {
      setBonusSaving(false);
    }
  };

  const handleBonusRemove = async () => {
    if (!bonusTarget) return;
    setBonusSaving(true);
    try {
      const res = await fetch(`/api/staff/${bonusTarget.id}/bonus-config`, { method: "DELETE" });
      if (res.ok) {
        toast(`Bonus config removed for ${bonusTarget.name}`, "success");
        setBonusTarget(null);
        fetchStaff();
      }
    } catch {
      toast("Failed to remove", "error");
    } finally {
      setBonusSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        role: formRole,
        contact: formContact.trim() || null,
        status: formStatus,
        baseSalary: Number(formBaseSalary) || 0,
      };

      const url = editingStaff ? `/api/staff/${editingStaff.id}` : "/api/staff";
      const method = editingStaff ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast(editingStaff ? "Staff updated" : "Staff added", "success");
        setShowForm(false);
        resetForm();
        fetchStaff();
      } else {
        const err = await res.json();
        setFormError(err.error || "Failed to save");
      }
    } catch {
      setFormError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/staff/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast(`"${deleteTarget.name}" deleted`, "success");
        fetchStaff();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete", "error");
      }
    } catch {
      toast("Failed to delete", "error");
    }
    setDeleteTarget(null);
  };

  const toggleStatus = async (s: Staff) => {
    const newStatus = s.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/staff/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast(`${s.name} marked ${newStatus}`, "success");
        fetchStaff();
      }
    } catch {
      toast("Failed to update status", "error");
    }
  };

  const activeCount = staff.filter((s) => s.status === "active").length;
  const totalCount = staff.length;
  const bonusConfigured = staff.filter((s) => s.bonusConfig?.active).length;


  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500";

  return (
    <>
      <PageHeader
        title="Staff Management"
        description={`Manage your staff members${totalCount > 0 ? ` — ${activeCount} active of ${totalCount}` : ""}${bonusConfigured > 0 ? ` · ${bonusConfigured} with bonus` : ""}`}
        action={
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Staff
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or contact..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Add/Edit Form (inline card) */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">
              {editingStaff ? `Edit — ${editingStaff.name}` : "Add New Staff Member"}
            </h3>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter name"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact</label>
              <input
                type="text"
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder="Phone or email"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Base Salary</label>
              <input
                type="number"
                value={formBaseSalary}
                onChange={(e) => setFormBaseSalary(e.target.value)}
                placeholder="0"
                className={inputClass}
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? "Saving..." : editingStaff ? "Update" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
          {formError && (
            <p className="text-xs text-red-600 mt-2">{formError}</p>
          )}
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {search || roleFilter || statusFilter ? "No staff match your filters" : "No staff members yet"}
            </p>
            {!showForm && !search && !roleFilter && !statusFilter && (
              <button
                onClick={openAddForm}
                className="mt-3 text-sm text-red-600 font-medium hover:text-red-700"
              >
                + Add your first staff member
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Contact</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-3">Base Salary</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Bonus Rule</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Added</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((s) => (
                  <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${s.status === "inactive" ? "opacity-60" : ""}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-red-600">{s.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS[s.role] || "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[s.role] || s.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {s.contact || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-gray-900">
                      {fmtRs(s.baseSalary || 0)}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.bonusConfig && s.bonusConfig.active ? (
                        <button
                          onClick={() => openBonusConfig(s)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          <Trophy className="w-3 h-3" />
                          {s.bonusConfig.bonusValue}% if ≥ {fmtRs(s.bonusConfig.minJobcardAmount)}
                        </button>
                      ) : s.bonusConfig && !s.bonusConfig.active ? (
                        <button
                          onClick={() => openBonusConfig(s)}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          Paused
                        </button>
                      ) : (
                        <button
                          onClick={() => openBonusConfig(s)}
                          className="text-xs text-gray-400 hover:text-red-600 cursor-pointer"
                        >
                          + Set bonus
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => toggleStatus(s)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                          s.status === "active"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                        title={`Click to mark ${s.status === "active" ? "inactive" : "active"}`}
                      >
                        {s.status === "active" ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {new Date(s.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/dashboard/staff/${s.id}`}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="View Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => openBonusConfig(s)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Bonus Config"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditForm(s)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Staff"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Bonus Configuration Modal */}
      <Modal
        open={!!bonusTarget}
        onClose={() => setBonusTarget(null)}
        title={bonusTarget ? `Bonus Config — ${bonusTarget.name}` : "Bonus Config"}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Configure bonus rules for this staff member. When a job card they&apos;re assigned to is completed and meets the minimum amount, bonus is automatically calculated.
          </p>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Minimum Job Card Amount (Rs) <span className="text-red-500">*</span>
            </label>
            <IntegerInput
              value={bonusMinAmount}
              onChange={setBonusMinAmount}
              className={inputClass}
              placeholder="e.g. 3000"
            />
            <p className="text-xs text-gray-400 mt-1">Job card total must be ≥ this to qualify</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Bonus Percentage (%) <span className="text-red-500">*</span>
            </label>
            <IntegerInput
              value={bonusValue}
              onChange={setBonusValue}
              className={inputClass}
              placeholder="e.g. 5"
            />
          </div>

          {bonusMinAmount && bonusValue && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
              <strong>Preview:</strong> {bonusTarget?.name} earns{" "}
              <span className="font-bold text-amber-700">
                {bonusValue}% of amount above {fmtRs(Number(bonusMinAmount))}
              </span>{" "}
              for each completed job card ≥ {fmtRs(Number(bonusMinAmount))}
              <span className="text-gray-500">
                {" "}(e.g. {fmtRs(Number(bonusMinAmount) + 2000)} → {bonusValue}% of Rs 2,000 = Rs {Math.round(2000 * Number(bonusValue) / 100)})
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={bonusActive}
                onChange={(e) => setBonusActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
            {!bonusActive && (
              <span className="text-xs text-gray-400">Bonus calculation is paused</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              {bonusTarget?.bonusConfig && (
                <button
                  type="button"
                  onClick={handleBonusRemove}
                  disabled={bonusSaving}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Remove bonus rule
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBonusTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBonusSave}
                disabled={bonusSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {bonusSaving ? "Saving..." : "Save Bonus Rule"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
