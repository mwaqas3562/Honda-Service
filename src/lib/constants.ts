/**
 * Shared UI constants used across dashboard pages.
 */

export const BIKE_MODELS = [
  "CD-70", "CD-70 Dream", "CG-125", "CG-125S", "CG-125 Self",
  "CB-125F", "CB-150F", "CB-150F SE", "Deluxe", "Pridor",
  "Navi", "CB-250F", "Other",
];

export const SERVICE_STATUS_COLOR: Record<string, string> = {
  pending: "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
};

export const SERVICE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

export const PURCHASE_STATUS_COLOR: Record<string, string> = {
  received: "bg-green-100 text-green-700",
  in_transit: "bg-yellow-100 text-yellow-700",
  ordered: "bg-blue-100 text-blue-700",
};

export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  received: "Received",
  in_transit: "In Transit",
  ordered: "Ordered",
};

export const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";

export const inputClassFull =
  "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white transition-shadow placeholder:text-gray-400";
