"use client";

import { CheckCircle } from "lucide-react";
import type { StockSummaryRow } from "@/components/AddStockForm";

interface StockSummaryProps {
  summary: StockSummaryRow[];
  message: string;
  onClose: () => void;
}

export default function StockSummary({
  summary,
  message,
  onClose,
}: StockSummaryProps) {
  const created = summary.filter((s) => s.action === "created");
  const updated = summary.filter((s) => s.action === "updated");

  return (
    <div className="space-y-5">
      {/* Header message */}
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-800">{message}</p>
          <p className="text-xs text-green-600 mt-1">
            {created.length > 0 && `${created.length} new part(s) created`}
            {created.length > 0 && updated.length > 0 && " · "}
            {updated.length > 0 && `${updated.length} existing part(s) updated`}
          </p>
        </div>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase">
                Part Name
              </th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600 text-xs uppercase">
                Status
              </th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs uppercase">
                Old Qty
              </th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs uppercase">
                Added
              </th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs uppercase">
                New Qty
              </th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs uppercase">
                Old Price
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs uppercase">
                New Avg Price
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium text-gray-900 block">
                      {row.partName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {row.partNumber} · {row.category}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      row.action === "created"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {row.action === "created" ? "New" : "Updated"}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-gray-500">
                  {row.oldQuantity}
                </td>
                <td className="px-3 py-3 text-right font-medium text-green-700">
                  +{row.addedQuantity}
                </td>
                <td className="px-3 py-3 text-right font-bold text-gray-900">
                  {row.newQuantity}
                </td>
                <td className="px-3 py-3 text-right text-gray-500">
                  {row.oldPrice > 0
                    ? `Rs ${Math.round(row.oldPrice).toLocaleString()}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  Rs {Math.round(row.newAvgPrice).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals row */}
      <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 text-sm">
        <span className="text-gray-600">
          Total items processed:{" "}
          <span className="font-semibold text-gray-900">{summary.length}</span>
        </span>
        <span className="text-gray-600">
          Total units added:{" "}
          <span className="font-semibold text-gray-900">
            {summary.reduce((sum, r) => sum + r.addedQuantity, 0).toLocaleString()}
          </span>
        </span>
      </div>

      {/* Close button */}
      <div className="flex justify-end pt-1">
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
