"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, RefreshCw, Edit3, Trash2, Wrench } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import IntegerInput from "@/components/IntegerInput";
import { fmtRs } from "@/lib/utils";

interface Labour {
  id: number;
  name: string;
  defaultPrice: number;
  notes: string | null;
  createdAt: string;
}

export default function LaboursPage() {
  const { toast } = useToast();
  const [labours, setLabours] = useState<Labour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLabour, setEditLabour] = useState<Labour | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Labour | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [notes, setNotes] = useState("");

  const fetchLabours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/labours");
      if (res.ok) setLabours(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabours();
  }, [fetchLabours]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return labours;
    const q = searchQuery.toLowerCase();
    return labours.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q)
    );
  }, [labours, searchQuery]);

  function resetForm() {
    setName("");
    setDefaultPrice("");
    setNotes("");
    setError("");
    setEditLabour(null);
  }

  function openEdit(labour: Labour) {
    setEditLabour(labour);
    setName(labour.name);
    setDefaultPrice(String(labour.defaultPrice));
    setNotes(labour.notes || "");
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Labour name is required");
    if (!defaultPrice || Number(defaultPrice) < 0) return setError("Price must be non-negative");

    setFormLoading(true);
    try {
      const body = {
        name: name.trim(),
        defaultPrice: Math.round(parseFloat(defaultPrice) || 0),
        notes: notes.trim() || null,
      };

      const url = editLabour ? `/api/labours/${editLabour.id}` : "/api/labours";
      const method = editLabour ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast(editLabour ? "Labour updated" : "Labour created", "success");
      setShowModal(false);
      resetForm();
      fetchLabours();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/labours/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Labour deleted", "success");
      setDeleteTarget(null);
      fetchLabours();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
      setDeleteTarget(null);
    }
  }


  const inputCls =
    "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow bg-white placeholder:text-gray-400";

  return (
    <>
      <PageHeader
        title="Labour / Services Master"
        description="Manage standard labour and service charges"
        action={
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Labour
          </button>
        }
      />

      {/* Search */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or notes..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  #
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Name
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Default Price
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Notes
                </th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-gray-400">Loading...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Wrench className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">
                      {labours.length > 0
                        ? "No results match your search"
                        : "No labour entries yet"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Add your first labour / service charge
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((labour, idx) => (
                  <tr
                    key={labour.id}
                    className="border-b border-gray-50 hover:bg-red-50/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-gray-900">{labour.name}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-right text-gray-900">
                      {fmtRs(labour.defaultPrice)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[250px]">
                      <div className="truncate">{labour.notes || "—"}</div>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => openEdit(labour)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(labour)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 text-sm text-gray-500">
            {filtered.length} labour item(s)
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editLabour ? `Edit — ${editLabour.name}` : "Add Labour / Service"}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Labour / Service Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Oil Change, Chain Adjustment"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Default Price (Rs) <span className="text-red-500">*</span>
            </label>
            <IntegerInput
              value={defaultPrice}
              onChange={setDefaultPrice}
              className={inputCls}
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} resize-none`}
              rows={3}
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {formLoading ? "Saving..." : editLabour ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Labour"
        message={`Delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
