"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, RefreshCw, Search, Printer, Eye, X, Trash2, ShoppingCart, Edit3, Lock, FileText, Hammer } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import SmartPartSearch, { type SearchablePart } from "@/components/SmartPartSearch";

interface SaleLabourItem {
  id: number;
  labourId: number;
  quantity: number;
  unitPrice: number;
  total: number;
  labour: { id: number; name: string; defaultPrice: number };
}

interface SaleItem {
  id: number;
  partId: number;
  quantity: number;
  unitPrice: number;
  total: number;
  part: { name: string; partNumber: string; stock?: number };
}

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
}

interface Sale {
  id: number;
  jobCardId: number | null;
  jobCard: JobCard | null;
  customer: string | null;
  date: string;
  laborCost: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentType: string;
  status: string;
  finalizedAt: string | null;
  items: SaleItem[];
  labourItems: SaleLabourItem[];
  createdAt: string;
}

interface Part {
  id: number;
  name: string;
  partNumber: string;
  salePrice: number;
  stock: number;
  aliases: string[];
  usageCount: number;
}

interface Labour {
  id: number;
  name: string;
  defaultPrice: number;
}

interface FormItem {
  id: number;
  partId: number;
  partName: string;
  partNumber: string;
  quantity: number;
  unitPrice: number;
  stock: number;
}

interface FormLabourItem {
  id: number;
  labourId: number;
  labourName: string;
  quantity: number;
  unitPrice: number;
}

export default function SalesPage() {
  const { toast } = useToast();
  const itemIdRef = useRef(1);

  const [sales, setSales] = useState<Sale[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [finalizeTarget, setFinalizeTarget] = useState<Sale | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Form state
  const [selectedJobCard, setSelectedJobCard] = useState<JobCard | null>(null);
  const [jcSearch, setJcSearch] = useState("");
  const [jcDropdownOpen, setJcDropdownOpen] = useState(false);
  const [jcHighlight, setJcHighlight] = useState(0);
  const [customer, setCustomer] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [discount, setDiscount] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [items, setItems] = useState<FormItem[]>([]);
  const [labourItems, setLabourItems] = useState<FormLabourItem[]>([]);

  // Part search — handled by SmartPartSearch component

  // Labour search state
  const labourIdRef = useRef(1);
  const labourSearchRef = useRef<HTMLInputElement>(null);
  const [labourSearch, setLabourSearch] = useState("");
  const [labourDropdownOpen, setLabourDropdownOpen] = useState(false);
  const [labourHighlight, setLabourHighlight] = useState(0);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const jcDropdownRef = useRef<HTMLDivElement>(null);
  const labourDropdownRef = useRef<HTMLDivElement>(null);

  // --- Data fetching ---
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales");
      if (res.ok) setSales(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchParts = useCallback(async () => {
    try {
      const res = await fetch("/api/parts");
      if (res.ok) setParts(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchLabours = useCallback(async () => {
    try {
      const res = await fetch("/api/labours");
      if (res.ok) setLabours(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchJobCards = useCallback(async () => {
    try {
      const res = await fetch("/api/job-cards?status=open");
      if (res.ok) setJobCards(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchSales(); fetchParts(); fetchLabours(); fetchJobCards(); }, [fetchSales, fetchParts, fetchLabours, fetchJobCards]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (jcDropdownRef.current && !jcDropdownRef.current.contains(e.target as Node)) setJcDropdownOpen(false);
      if (labourDropdownRef.current && !labourDropdownRef.current.contains(e.target as Node)) setLabourDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // --- Job Card typeahead ---
  const filteredJobCards = useMemo(() => {
    if (!jcSearch.trim()) return jobCards;
    const q = jcSearch.toLowerCase();
    return jobCards.filter((jc) =>
      jc.jobCardNumber.toLowerCase().includes(q) ||
      jc.customerName.toLowerCase().includes(q) ||
      jc.vehicleNumber.toLowerCase().includes(q) ||
      jc.bikeModel.toLowerCase().includes(q)
    );
  }, [jobCards, jcSearch]);

  function selectJobCard(jc: JobCard) {
    setSelectedJobCard(jc);
    setJcSearch("");
    setJcDropdownOpen(false);
    setCustomer(jc.customerName);
    setLaborCost(String(jc.laborCost));
  }

  function clearJobCard() {
    setSelectedJobCard(null);
    setJcSearch("");
    setCustomer("");
    setLaborCost("");
  }

  function handleJcKeyDown(e: React.KeyboardEvent) {
    if (!jcDropdownOpen || filteredJobCards.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setJcHighlight((h) => Math.min(h + 1, filteredJobCards.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setJcHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectJobCard(filteredJobCards[jcHighlight]);
    }
  }

  // --- Part search & auto-add ---
  const addedPartIds = useMemo(() => new Set(items.map((i) => i.partId)), [items]);

  const handlePartSelect = useCallback((part: SearchablePart) => {
    const newItem: FormItem = {
      id: itemIdRef.current++,
      partId: part.id,
      partName: part.name,
      partNumber: part.partNumber,
      quantity: 1,
      unitPrice: part.salePrice,
      stock: part.stock,
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  function updateItemQty(id: number, qty: number) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.stock)) } : i));
  }

  function updateItemPrice(id: number, price: number) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, unitPrice: Math.max(0, price) } : i));
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }



  // --- Labour search & auto-add ---
  const availableLabours = useMemo(() => {
    const addedIds = new Set(labourItems.map((i) => i.labourId));
    const remaining = labours.filter((l) => !addedIds.has(l.id));
    if (!labourSearch.trim()) return remaining;
    const q = labourSearch.toLowerCase();
    return remaining.filter((l) => l.name.toLowerCase().includes(q));
  }, [labours, labourSearch, labourItems]);

  function addLabourToItems(labour: Labour) {
    const newItem: FormLabourItem = {
      id: labourIdRef.current++,
      labourId: labour.id,
      labourName: labour.name,
      quantity: 1,
      unitPrice: labour.defaultPrice,
    };
    setLabourItems((prev) => [...prev, newItem]);
    setLabourSearch("");
    setLabourDropdownOpen(false);
    setLabourHighlight(0);
    setTimeout(() => labourSearchRef.current?.focus(), 0);
  }

  function updateLabourQty(id: number, qty: number) {
    setLabourItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  }

  function updateLabourPrice(id: number, price: number) {
    setLabourItems((prev) => prev.map((i) => i.id === id ? { ...i, unitPrice: Math.max(0, price) } : i));
  }

  function removeLabourItem(id: number) {
    setLabourItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleLabourKeyDown(e: React.KeyboardEvent) {
    if (!labourDropdownOpen || availableLabours.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setLabourHighlight((h) => Math.min(h + 1, availableLabours.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setLabourHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      addLabourToItems(availableLabours[labourHighlight]);
    }
  }

  // --- Reset & Submit ---
  function resetForm() {
    setSelectedJobCard(null);
    setJcSearch("");
    setCustomer("");
    setDiscount("");
    setLaborCost("");
    setCashReceived("");
    setPaymentType("cash");
    setError("");
    setItems([]);
    setLabourItems([]);
    setLabourSearch("");
    setLabourDropdownOpen(false);
    setJcDropdownOpen(false);
    setEditSale(null);
  }

  function openEdit(sale: Sale) {
    setEditSale(sale);
    setCustomer(sale.customer || "");
    setPaymentType(sale.paymentType);
    setDiscount(sale.discount > 0 ? String(sale.discount) : "");
    setLaborCost(sale.labourItems.length > 0 ? "" : (sale.laborCost > 0 ? String(sale.laborCost) : ""));
    setCashReceived("");
    if (sale.jobCard) {
      setSelectedJobCard(sale.jobCard);
    } else {
      setSelectedJobCard(null);
    }
    setItems(
      sale.items.map((item, idx) => ({
        id: idx + 1,
        partId: item.partId,
        partName: item.part.name,
        partNumber: item.part.partNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        stock: item.part.stock ?? item.quantity,
      }))
    );
    itemIdRef.current = sale.items.length + 1;
    setLabourItems(
      (sale.labourItems || []).map((item, idx) => ({
        id: idx + 1,
        labourId: item.labourId,
        labourName: item.labour.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    );
    labourIdRef.current = (sale.labourItems || []).length + 1;
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (items.length === 0 && labourItems.length === 0) return setError("Add at least one part or labour item");

    for (const item of items) {
      if (item.quantity > item.stock) {
        return setError(`${item.partName}: Only ${item.stock} in stock, you entered ${item.quantity}`);
      }
    }

    setFormLoading(true);
    try {
      const body = {
        jobCardId: selectedJobCard?.id || undefined,
        customer: customer.trim() || undefined,
        paymentType,
        discount: Math.round(parseFloat(discount) || 0),
        laborCost: Math.round(parseFloat(laborCost) || 0),
        items: items.map((i) => ({
          partId: i.partId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        labourItems: labourItems.map((i) => ({
          labourId: i.labourId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      };

      const url = editSale ? `/api/sales/${editSale.id}` : "/api/sales";
      const method = editSale ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast(editSale ? "Draft updated successfully" : "Draft invoice created", "success");
      setShowModal(false);
      resetForm();
      fetchSales();
      fetchParts();
      fetchJobCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sale");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleFinalize() {
    if (!finalizeTarget) return;
    try {
      const res = await fetch(`/api/sales/${finalizeTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Invoice S${String(finalizeTarget.id).padStart(3, "0")} finalized`, "success");
      setFinalizeTarget(null);
      fetchSales();
      fetchParts();
      fetchJobCards();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to finalize", "error");
      setFinalizeTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/sales/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Draft S${String(deleteTarget.id).padStart(3, "0")} deleted`, "success");
      setDeleteTarget(null);
      fetchSales();
      fetchParts();
      fetchJobCards();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
      setDeleteTarget(null);
    }
  }

  // --- Helpers ---
  const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
  const paymentColor: Record<string, string> = {
    cash: "bg-green-100 text-green-700",
    card: "bg-blue-100 text-blue-700",
    credit: "bg-yellow-100 text-yellow-700",
  };

  const partsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const labourTotal = labourItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const liveLabor = labourTotal > 0 ? labourTotal : Math.round(parseFloat(laborCost) || 0);
  const liveDiscount = Math.round(parseFloat(discount) || 0);
  const liveTotal = Math.max(0, partsTotal + liveLabor - liveDiscount);
  const liveCashReceived = Math.round(parseFloat(cashReceived) || 0);
  const liveRemaining = Math.max(0, liveTotal - liveCashReceived);

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (s.customer || "").toLowerCase().includes(q);
        const matchItems = s.items.some((i) => i.part.name.toLowerCase().includes(q));
        const matchId = `S${String(s.id).padStart(3, "0")}`.toLowerCase().includes(q);
        const matchJC = (s.jobCard?.jobCardNumber || "").toLowerCase().includes(q);
        if (!matchName && !matchItems && !matchId && !matchJC) return false;
      }
      if (paymentFilter && s.paymentType !== paymentFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (dateFrom && new Date(s.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(s.createdAt) > to) return false;
      }
      return true;
    });
  }, [sales, searchQuery, paymentFilter, statusFilter, dateFrom, dateTo]);

  function printInvoice() {
    if (!invoiceSale) return;
    const w = window.open("", "_blank", "width=400,height=800");
    if (!w) return;
    const s = invoiceSale;
    const date = new Date(s.createdAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
    const hasLabourItems = (s.labourItems || []).length > 0;
    const hasLegacyLabor = s.laborCost > 0 && !hasLabourItems;
    const partsTotal = s.items.reduce((sum, i) => sum + i.total, 0);
    const labourTotal = hasLabourItems
      ? s.labourItems.reduce((sum: number, i: SaleLabourItem) => sum + i.total, 0)
      : hasLegacyLabor ? s.laborCost : 0;
    const subTotal = partsTotal + labourTotal;

    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fmt = (n: number) => Math.round(n).toLocaleString();

    // Force-wrap name at ~14 chars per line (break at spaces)
    const wrapName = (name: string, maxLen = 12): string => {
      const escaped = esc(name);
      if (escaped.length <= maxLen) return escaped;
      const words = escaped.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        if (line && (line.length + 1 + word.length) > maxLen) {
          lines.push(line);
          line = word;
        } else {
          line = line ? line + " " + word : word;
        }
      }
      if (line) lines.push(line);
      return lines.join("<br>");
    };

    // Parts rows
    const partsRows = s.items.map(item =>
      `<tr><td class="nm">${wrapName(item.part.name)}</td><td class="qty">${item.quantity}</td><td class="rt">${fmt(item.unitPrice)}</td><td class="tt">${fmt(item.total)}</td></tr>`
    ).join("");

    // Labour rows
    let labourRows = "";
    if (hasLabourItems) {
      labourRows = s.labourItems.map((item: SaleLabourItem) =>
        `<tr><td class="nm">${wrapName(item.labour.name)}</td><td class="qty">${item.quantity}</td><td class="rt">${fmt(item.unitPrice)}</td><td class="tt">${fmt(item.total)}</td></tr>`
      ).join("");
    } else if (hasLegacyLabor) {
      labourRows = `<tr><td class="nm">Service Charges</td><td class="qty">1</td><td class="rt">${fmt(s.laborCost)}</td><td class="tt">${fmt(s.laborCost)}</td></tr>`;
    }

    w.document.write(`<html><head><title>Receipt</title>
<style>
  @page { margin: 0; size: 80mm 3276mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; width: 100%; max-width: 80mm; padding: 2mm 2mm; color: #000; line-height: 1.3; word-wrap: break-word; }
  table { width: 100%; border-collapse: collapse; }
  .dash { border-bottom: 1px dashed #000; margin: 2px 0; }
  .dot { border-bottom: 1px dotted #000; margin: 2px 0; }
  .items-tbl { table-layout: fixed; }
  .items-tbl col:nth-child(1) { width: 38%; }
  .items-tbl col:nth-child(2) { width: 12%; }
  .items-tbl col:nth-child(3) { width: 25%; }
  .items-tbl col:nth-child(4) { width: 25%; }
  .nm { padding:1px 2px 1px 0; font-size:9px; word-break:break-word; overflow-wrap:break-word; }
  .qty { padding:1px 1px; text-align:center; white-space:nowrap; }
  .rt { padding:1px 1px; text-align:right; white-space:nowrap; }
  .tt { padding:1px 0; text-align:right; white-space:nowrap; }
  .row { display: flex; justify-content: space-between; font-size: 10px; }
  @media print {
    @page { margin: 0; }
    body { width: 100%; max-width: 80mm; padding: 2mm 2mm; }
  }
</style></head><body>

<div style="text-align:center;margin-bottom:3px">
  <div style="font-size:14px;font-weight:bold">Danish Honda Palace</div>
  <div style="font-size:9px;margin-top:1px;line-height:1.3">Near LDA Round About Opp, Soneri Bank</div>
  <div style="font-size:9px;line-height:1.3">22- KM Main Ferozpur RD LHR</div>
  <div style="font-size:9px;margin-top:1px">Ph: 0370-5097234</div>
</div>

<div class="dash"></div>

<div class="row"><span><b>Bill No.</b> S${String(s.id).padStart(3, "0")}</span><span><b>Date</b> ${date}</span></div>
${s.jobCard ? `<div class="row"><span><b>Reg#</b> ${esc(s.jobCard.vehicleNumber)}</span><span>${esc(s.jobCard.bikeModel)}</span></div>` : ""}
<div style="font-size:10px"><b>Customer</b> ${esc(s.customer || "Walk-in")}</div>
${s.jobCard ? `<div style="font-size:10px"><b>Phone</b> ${esc(s.jobCard.customerPhone)}</div>` : ""}
${s.jobCard ? `<div style="font-size:10px"><b>Mechanic</b> ${esc(s.jobCard.mechanicName)}</div>` : ""}

<table class="items-tbl" style="margin-top:2px;font-size:10px;border-top:1px solid #000;border-bottom:1px solid #000">
  <colgroup><col><col><col><col></colgroup>
  <tr style="font-weight:bold">
    <td style="padding:1px 0">Item</td>
    <td style="padding:1px 1px;text-align:center">Qty</td>
    <td style="padding:1px 1px;text-align:right">Rate</td>
    <td style="padding:1px 0;text-align:right">Total</td>
  </tr>
</table>

${s.items.length > 0 ? `
<div style="margin-top:2px">
  <div style="font-weight:bold;font-size:10px">Parts</div>
  <div class="dash"></div>
  <table class="items-tbl" style="font-size:10px">
    <colgroup><col><col><col><col></colgroup>
    ${partsRows}
  </table>
</div>
` : ""}

${(hasLabourItems || hasLegacyLabor) ? `
<div style="margin-top:2px">
  <div style="font-weight:bold;font-size:10px">Labour</div>
  <div class="dash"></div>
  <table class="items-tbl" style="font-size:10px">
    <colgroup><col><col><col><col></colgroup>
    ${labourRows}
  </table>
</div>
` : ""}

<div class="dot"></div>

<div class="row" style="margin-top:2px;font-size:11px"><span><b>Sub Total</b></span><span><b>${fmt(subTotal)}</b></span></div>
${s.discount > 0 ? `<div class="row" style="font-size:11px"><span><b>Discount</b></span><span><b>${fmt(s.discount)}</b></span></div>` : ""}

<div style="text-align:center;margin-top:3px;font-size:13px;font-weight:bold">Grand Total</div>
<div style="text-align:center;font-size:14px;font-weight:bold;margin-bottom:1px">${fmt(s.total)}</div>

<div class="dot"></div>

<div style="text-align:center;margin-top:4px;font-size:11px;font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',Tahoma,sans-serif">
  آپ کی تشریف آوری کا شکریہ
</div>

<div style="margin-top:8px"></div>
</body></html>`);
    w.document.close();
    w.print();
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow bg-white placeholder:text-gray-400";

  return (
    <>
      <PageHeader
        title="Sales"
        description="Track all spare parts sales & service billing"
        action={
          <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Sale
          </button>
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900">{sales.filter((s) => s.status === "final").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
          <p className="text-2xl font-bold text-green-600">{fmtRs(sales.filter((s) => s.status === "final").reduce((sum, sl) => sum + sl.total, 0))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Drafts</p>
          <p className="text-2xl font-bold text-amber-600">{sales.filter((s) => s.status === "draft").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Sale</p>
          <p className="text-2xl font-bold text-blue-600">
            {sales.filter((s) => s.status === "final").length > 0 ? fmtRs(Math.round(sales.filter((s) => s.status === "final").reduce((sum, sl) => sum + sl.total, 0) / sales.filter((s) => s.status === "final").length)) : "Rs 0"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by customer, part, job card..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" title="From date" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" title="To date" />
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer">
          <option value="">All Payments</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="credit">Credit</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="final">Final</option>
        </select>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">ID</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Job Card</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Items</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Total</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Payment</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center">
                  <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-gray-400">Loading sales...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center">
                  <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">{sales.length > 0 ? "No sales match your filters" : "No sales yet"}</p>
                  <p className="text-xs text-gray-400 mt-1">Create your first sale to get started</p>
                </td></tr>
              ) : (
                filtered.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-500">S{String(sale.id).padStart(3, "0")}</td>
                    <td className="px-5 py-3.5">
                      {sale.jobCard ? (
                        <span className="text-xs font-mono font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">{sale.jobCard.jobCardNumber}</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-gray-900">{sale.customer || "Walk-in"}</div>
                      {sale.jobCard && <div className="text-xs text-gray-400 mt-0.5">{sale.jobCard.bikeModel} · {sale.jobCard.vehicleNumber}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[200px]">
                      <div className="truncate">{sale.items.map((i) => `${i.part.name} ×${i.quantity}`).join(", ")}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{sale.items.length} part(s){(sale.labourItems || []).length > 0 ? `, ${sale.labourItems.length} labour` : ""}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-right text-gray-900">{fmtRs(sale.total)}</td>
                    <td className="px-5 py-3.5 text-center">
                      {sale.status === "draft" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                          <FileText className="w-3 h-3" /> Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                          <Lock className="w-3 h-3" /> Final
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{new Date(sale.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${paymentColor[sale.paymentType] || "bg-gray-100 text-gray-700"}`}>
                        {sale.paymentType.charAt(0).toUpperCase() + sale.paymentType.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => setInvoiceSale(sale)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Invoice">
                          <Eye className="w-4 h-4" />
                        </button>
                        {sale.status === "draft" && (
                          <>
                            <button onClick={() => openEdit(sale)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Draft">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setFinalizeTarget(sale)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Finalize Invoice">
                              <Lock className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(sale)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete Draft">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
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
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between text-sm text-gray-500">
            <span>{filtered.length} sale(s)</span>
            <span className="font-semibold text-gray-700">Total: {fmtRs(filtered.reduce((s, sl) => s + sl.total, 0))}</span>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      <Modal open={!!invoiceSale} onClose={() => setInvoiceSale(null)} title="Sale Invoice" wide>
        {invoiceSale && (
          <>
            <div ref={invoiceRef} className="max-w-2xl mx-auto">
              <div className="text-center border-b-[3px] border-red-600 pb-4 mb-5">
                <h1 className="text-2xl font-extrabold text-red-600 tracking-wide">Danish Honda Palace</h1>
                <p className="text-xs text-gray-500 mt-1">Near LDA Round About Opp, Soneri Bank, 22- KM Main Ferozpur RD LHR</p>
                <p className="text-sm text-gray-700 mt-2 font-semibold">
                  Invoice # S{String(invoiceSale.id).padStart(3, "0")}
                  {invoiceSale.jobCard && ` — ${invoiceSale.jobCard.jobCardNumber}`}
                  {" "} | {new Date(invoiceSale.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex justify-between gap-6 mb-5 text-sm leading-7">
                <div>
                  <p><span className="font-semibold text-gray-800">Customer:</span> {invoiceSale.customer || "Walk-in"}</p>
                  {invoiceSale.jobCard && (
                    <>
                      <p><span className="font-semibold text-gray-800">Phone:</span> {invoiceSale.jobCard.customerPhone}</p>
                      <p><span className="font-semibold text-gray-800">Vehicle #:</span> {invoiceSale.jobCard.vehicleNumber}</p>
                      <p><span className="font-semibold text-gray-800">Bike Model:</span> {invoiceSale.jobCard.bikeModel}</p>
                      <p><span className="font-semibold text-gray-800">Meter Reading:</span> {invoiceSale.jobCard.meterReading.toLocaleString()} km</p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p><span className="font-semibold text-gray-800">Date:</span> {new Date(invoiceSale.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  <p><span className="font-semibold text-gray-800">Payment:</span> <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold">{invoiceSale.paymentType.charAt(0).toUpperCase() + invoiceSale.paymentType.slice(1)}</span></p>
                  {invoiceSale.jobCard && (
                    <p><span className="font-semibold text-gray-800">Mechanic:</span> {invoiceSale.jobCard.mechanicName}</p>
                  )}
                </div>
              </div>
              {/* ── Parts Section ── */}
              {invoiceSale.items.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-5 bg-red-600 rounded-full" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Parts</h3>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-t-2 border-b border-red-600">
                        <th className="py-2 px-3 text-left text-xs font-bold text-gray-600 uppercase w-8">#</th>
                        <th className="py-2 px-3 text-left text-xs font-bold text-gray-600 uppercase">Part Name</th>
                        <th className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase w-12">Qty</th>
                        <th className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase w-24">Price</th>
                        <th className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceSale.items.map((item, idx) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-gray-900">{item.part.name}</div>
                            <div className="text-[10px] text-gray-400">{item.part.partNumber}</div>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-700">{item.quantity}</td>
                          <td className="py-2 px-3 text-right text-gray-700">Rs {Math.round(item.unitPrice).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-900">Rs {Math.round(item.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50/60">
                        <td colSpan={4} className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase">Parts Total</td>
                        <td className="py-2 px-3 text-right text-sm font-bold text-gray-900">Rs {Math.round(invoiceSale.items.reduce((s, i) => s + i.total, 0)).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── Labour Section ── */}
              {(() => {
                const hasLabourItems = (invoiceSale.labourItems || []).length > 0;
                const hasLegacyLabor = invoiceSale.laborCost > 0 && !hasLabourItems;
                if (!hasLabourItems && !hasLegacyLabor) return null;
                const labourItemsTotal = hasLabourItems ? invoiceSale.labourItems.reduce((s: number, i: SaleLabourItem) => s + i.total, 0) : invoiceSale.laborCost;
                return (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Labour</h3>
                    </div>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-amber-50 border-t-2 border-b border-amber-400">
                          <th className="py-2 px-3 text-left text-xs font-bold text-gray-600 uppercase w-8">#</th>
                          <th className="py-2 px-3 text-left text-xs font-bold text-gray-600 uppercase">Labour Name</th>
                          <th className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase w-12">Qty</th>
                          <th className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase w-24">Price</th>
                          <th className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hasLabourItems ? invoiceSale.labourItems.map((item, idx) => (
                          <tr key={`l-${item.id}`} className="border-b border-amber-100 bg-amber-50/30">
                            <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-gray-900">{item.labour.name}</td>
                            <td className="py-2 px-3 text-right text-gray-700">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-gray-700">Rs {Math.round(item.unitPrice).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900">Rs {Math.round(item.total).toLocaleString()}</td>
                          </tr>
                        )) : (
                          <tr className="border-b border-gray-100 bg-amber-50/20">
                            <td className="py-2 px-3 text-gray-500">1</td>
                            <td className="py-2 px-3 font-medium text-gray-900">Service Charges</td>
                            <td className="py-2 px-3 text-right text-gray-700">1</td>
                            <td className="py-2 px-3 text-right text-gray-700">Rs {Math.round(invoiceSale.laborCost).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900">Rs {Math.round(invoiceSale.laborCost).toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-amber-200 bg-amber-50/60">
                          <td colSpan={4} className="py-2 px-3 text-right text-xs font-bold text-gray-600 uppercase">Labour Total</td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-gray-900">Rs {Math.round(labourItemsTotal).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

              {/* ── Grand Total ── */}
              <div className="border-t-2 border-b-2 border-gray-800 bg-gray-50 px-4 py-3 mb-4">
                {invoiceSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Subtotal</span>
                    <span>Rs {Math.round(invoiceSale.subtotal).toLocaleString()}</span>
                  </div>
                )}
                {invoiceSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-600 mb-1">
                    <span>Discount</span>
                    <span>-Rs {Math.round(invoiceSale.discount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-base font-extrabold text-gray-900">Grand Total</span>
                  <span className="text-xl font-extrabold text-gray-900">Rs {Math.round(invoiceSale.total).toLocaleString()}</span>
                </div>
              </div>
              <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-300">
                <p className="text-xs text-gray-400">Thank you for choosing Danish Honda Palace!</p>
                <p className="text-xs text-gray-400 mt-1">For queries, contact us at your nearest branch.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => setInvoiceSale(null)} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Close</button>
              <button onClick={printInvoice} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                <Printer className="w-4 h-4" /> Print Invoice
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* New/Edit Sale Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editSale ? `Edit Draft — S${String(editSale.id).padStart(3, "0")}` : "New Sale (Draft)"} wide>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg font-medium">{error}</div>}

          {/* Two-column: Job Card + Customer Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Job Card */}
            <div ref={jcDropdownRef} className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Job Card <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              {selectedJobCard ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 text-gray-700 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono font-bold text-red-600 text-base">{selectedJobCard.jobCardNumber}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="font-medium">{selectedJobCard.customerName}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600">
                        <div><span className="text-gray-400">Phone:</span> {selectedJobCard.customerPhone}</div>
                        <div><span className="text-gray-400">Vehicle:</span> {selectedJobCard.vehicleNumber}</div>
                        <div><span className="text-gray-400">Bike:</span> {selectedJobCard.bikeModel}</div>
                        <div><span className="text-gray-400">Meter:</span> {selectedJobCard.meterReading.toLocaleString()} km</div>
                        <div><span className="text-gray-400">Mechanic:</span> {selectedJobCard.mechanicName}</div>
                        <div><span className="text-gray-400">Labor:</span> Rs {Math.round(selectedJobCard.laborCost).toLocaleString()}</div>
                      </div>
                    </div>
                    <button type="button" onClick={clearJobCard} className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove job card">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={jcSearch}
                      onChange={(e) => { setJcSearch(e.target.value); setJcDropdownOpen(true); setJcHighlight(0); }}
                      onFocus={() => setJcDropdownOpen(true)}
                      onKeyDown={handleJcKeyDown}
                      placeholder="Search job cards..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white transition-shadow"
                      autoComplete="off"
                    />
                  </div>
                  {jcDropdownOpen && filteredJobCards.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                      {filteredJobCards.map((jc, idx) => (
                        <button
                          key={jc.id}
                          type="button"
                          onClick={() => selectJobCard(jc)}
                          className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 transition-colors ${idx === jcHighlight ? "bg-red-50" : "hover:bg-gray-50"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-red-600">{jc.jobCardNumber}</span>
                              <span className="text-gray-400 mx-1.5">—</span>
                              <span className="font-medium text-gray-900">{jc.customerName}</span>
                            </div>
                            <span className="text-xs text-gray-400">{jc.bikeModel}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{jc.vehicleNumber} · {jc.mechanicName}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {jcDropdownOpen && jcSearch && filteredJobCards.length === 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl px-4 py-3 text-sm text-gray-400">
                      No open job cards found
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: Customer & Payment */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Customer</label>
                  <input type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} className={inputCls} placeholder="e.g. Ali Khan" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment</label>
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={`${inputCls} cursor-pointer`}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount (Rs)</label>
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} placeholder="0" min="0" />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Parts Search & Auto-Add */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Add Parts
              {items.length > 0 && <span className="text-xs text-gray-400 font-normal ml-2">{items.length} added</span>}
            </label>
            <SmartPartSearch
              parts={parts}
              excludeIds={addedPartIds}
              onSelect={handlePartSelect}
              placeholder="Type part name, local name, or number..."
            />
          </div>

          {/* Added Parts Table */}
          {items.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Part</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Qty</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Price</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.partName}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{item.partNumber} · <span className={item.quantity >= item.stock ? "text-red-500 font-medium" : ""}>Stock: {item.stock}</span></div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemQty(item.id, parseInt(e.target.value, 10) || 1)}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                          min="1"
                          max={item.stock}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {fmtRs(item.quantity * item.unitPrice)}
                      </td>
                      <td className="px-2 py-3">
                        <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove part">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Labour Search & Auto-Add */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <Hammer className="w-4 h-4 inline-block mr-1 -mt-0.5" />
              Add Labour / Services
              {labourItems.length > 0 && <span className="text-xs text-gray-400 font-normal ml-2">{labourItems.length} added</span>}
            </label>
            <div ref={labourDropdownRef} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={labourSearchRef}
                type="text"
                value={labourSearch}
                onChange={(e) => { setLabourSearch(e.target.value); setLabourDropdownOpen(true); setLabourHighlight(0); }}
                onFocus={() => { if (labourSearch.trim()) setLabourDropdownOpen(true); }}
                onKeyDown={handleLabourKeyDown}
                placeholder="Type labour / service name to search & add..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white transition-shadow"
                autoComplete="off"
              />
              {labourDropdownOpen && labourSearch.trim() && availableLabours.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {availableLabours.slice(0, 20).map((l, idx) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => addLabourToItems(l)}
                      className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors ${idx === labourHighlight ? "bg-red-50" : "hover:bg-gray-50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{l.name}</div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className="font-bold text-gray-900">Rs {Math.round(l.defaultPrice).toLocaleString()}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {labourDropdownOpen && labourSearch.trim() && availableLabours.length === 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl px-4 py-3 text-sm text-gray-400">
                  No labour/services found for &ldquo;{labourSearch}&rdquo;
                </div>
              )}
            </div>
          </div>

          {/* Added Labour Table */}
          {labourItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50/80 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Labour / Service</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Qty</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Price</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {labourItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.labourName}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLabourQty(item.id, parseInt(e.target.value, 10) || 1)}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                          min="1"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLabourPrice(item.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {fmtRs(item.quantity * item.unitPrice)}
                      </td>
                      <td className="px-2 py-3">
                        <button type="button" onClick={() => removeLabourItem(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove labour">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Live Totals & Payment */}
          {(items.length > 0 || liveLabor > 0) && (
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="px-5 py-4 space-y-1.5">
                {items.length > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Parts ({items.length} items)</span><span className="font-medium">{fmtRs(partsTotal)}</span>
                  </div>
                )}
                {labourTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Labour ({labourItems.length} items)</span><span className="font-medium">{fmtRs(labourTotal)}</span>
                  </div>
                )}
                {liveLabor > 0 && labourTotal === 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Labor Charges</span><span className="font-medium">{fmtRs(liveLabor)}</span>
                  </div>
                )}
                {liveDiscount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Total Discount</span><span className="font-medium">-{fmtRs(liveDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900 text-base">Grand Total</span>
                  <span className="text-xl font-extrabold text-gray-900">{fmtRs(liveTotal)}</span>
                </div>
              </div>
              {/* Cash Received & Remaining */}
              <div className="px-5 py-3 bg-gray-100/80 border-t border-gray-200 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Cash Received (Rs)</label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0"
                    className="w-36 px-3 py-1.5 border border-gray-200 rounded-md text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                    min="0"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${liveRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
                    {liveRemaining > 0 ? "Remaining Amount" : "Change"}
                  </span>
                  <span className={`text-lg font-extrabold ${liveRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
                    {liveCashReceived > 0
                      ? liveRemaining > 0
                        ? fmtRs(liveRemaining)
                        : liveCashReceived > liveTotal
                          ? fmtRs(liveCashReceived - liveTotal)
                          : "Rs 0"
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={formLoading || (items.length === 0 && labourItems.length === 0)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
              <FileText className="w-4 h-4" />
              {formLoading ? "Saving..." : editSale ? "Update Draft" : "Save as Draft"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Finalize Confirmation */}
      <ConfirmDialog
        open={!!finalizeTarget}
        title="Finalize Invoice"
        message={`Once finalized, invoice S${String(finalizeTarget?.id ?? 0).padStart(3, "0")} cannot be edited or deleted. Stock will be deducted and the invoice will be locked permanently. Are you sure?`}
        confirmLabel="Finalize"
        onConfirm={handleFinalize}
        onCancel={() => setFinalizeTarget(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Draft"
        message={`Delete draft invoice S${String(deleteTarget?.id ?? 0).padStart(3, "0")}? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
