"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Subcategory {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  subcategories: Subcategory[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category"; id: number; name: string } | null>(null);

  // Add form
  const [catName, setCatName] = useState("");
  const [subcats, setSubcats] = useState("");
  const [formError, setFormError] = useState("");

  // Add subcategory inline
  const [addSubFor, setAddSubFor] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState("");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      if (res.ok) setCategories(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!catName.trim()) return setFormError("Name is required");
    try {
      const subcategories = subcats.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName.trim(), subcategories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAddModal(false);
      setCatName(""); setSubcats("");
      fetchCategories();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    }
  }

  async function handleAddSubcategory(catId: number) {
    if (!newSubName.trim()) return;
    try {
      await fetch(`/api/categories/${catId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSubName.trim() }),
      });
      setAddSubFor(null);
      setNewSubName("");
      fetchCategories();
    } catch (err) { console.error(err); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      fetchCategories();
    } catch (err) { console.error(err); }
    setDeleteTarget(null);
  }

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";

  return (
    <>
      <PageHeader
        title="Categories"
        description="Manage part categories and subcategories"
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center">
            <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No categories yet. Create your first category.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                  <button onClick={() => toggleExpand(cat.id)} className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    {cat.subcategories.length > 0 ? (
                      expanded.has(cat.id) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : <span className="w-4" />}
                    {cat.name}
                    <span className="text-xs text-gray-400 font-normal">({cat.subcategories.length} sub)</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setAddSubFor(cat.id); setNewSubName(""); }} className="text-xs text-red-600 hover:text-red-700 font-medium">+ Sub</button>
                    <button onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Inline add subcategory */}
                {addSubFor === cat.id && (
                  <div className="px-12 py-2 bg-gray-50 flex gap-2">
                    <input type="text" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSubcategory(cat.id)} className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="Subcategory name" autoFocus />
                    <button onClick={() => handleAddSubcategory(cat.id)} className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Add</button>
                    <button onClick={() => setAddSubFor(null)} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                  </div>
                )}
                {/* Subcategories */}
                {expanded.has(cat.id) && cat.subcategories.length > 0 && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {cat.subcategories.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between px-12 py-2 text-sm text-gray-600 border-b border-gray-100 last:border-0">
                        <span>↳ {sub.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {!loading && categories.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            {categories.length} categories · {categories.reduce((s, c) => s + c.subcategories.length, 0)} subcategories
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Category">
        <form onSubmit={handleAddCategory} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
            <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} className={inputClass} placeholder="e.g. Engine Parts" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subcategories (comma-separated, optional)</label>
            <input type="text" value={subcats} onChange={(e) => setSubcats(e.target.value)} className={inputClass} placeholder="e.g. Pistons, Rings, Gaskets" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        message={deleteTarget ? `Delete "${deleteTarget.name}" and all its subcategories?` : ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
