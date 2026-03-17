"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Search, Phone, ShoppingCart, Wrench, DollarSign, Calendar } from "lucide-react";

interface Customer {
  name: string;
  phone: string | null;
  salesCount: number;
  salesTotal: number;
  servicesCount: number;
  servicesTotal: number;
  totalSpent: number;
  totalVisits: number;
  bikes: string[];
  vehicles: string[];
  lastVisit: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        c.bikes.some((b) => b.toLowerCase().includes(q)) ||
        c.vehicles.some((v) => v.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} total customers</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, bike or vehicle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">
                {fmtRs(customers.reduce((sum, c) => sum + c.totalSpent, 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-xl font-bold text-gray-900">
                {customers.reduce((sum, c) => sum + c.salesCount, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Services</p>
              <p className="text-xl font-bold text-gray-900">
                {customers.reduce((sum, c) => sum + c.servicesCount, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bikes</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle #</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Sales</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Services</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total Spent</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No customers found
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-red-700 font-medium text-xs">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.bikes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.bikes.map((b, j) => (
                            <span
                              key={j}
                              className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.vehicles && c.vehicles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.vehicles.map((v, j) => (
                            <span
                              key={j}
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.salesCount > 0 ? (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                          {c.salesCount}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.servicesCount > 0 ? (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                          {c.servicesCount}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtRs(c.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3" />
                      {fmtDate(c.lastVisit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-700 font-bold text-xl">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                {selectedCustomer.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedCustomer.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">Parts Purchases</p>
                <p className="text-lg font-bold text-green-800">{selectedCustomer.salesCount}</p>
                <p className="text-sm text-green-700">{fmtRs(selectedCustomer.salesTotal)}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-purple-600 font-medium">Services</p>
                <p className="text-lg font-bold text-purple-800">{selectedCustomer.servicesCount}</p>
                <p className="text-sm text-purple-700">{fmtRs(selectedCustomer.servicesTotal)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium">Total Spent</p>
                <p className="text-lg font-bold text-blue-800">{fmtRs(selectedCustomer.totalSpent)}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600 font-medium">Last Visit</p>
                <p className="text-lg font-bold text-orange-800">{fmtDate(selectedCustomer.lastVisit)}</p>
              </div>
            </div>

            {selectedCustomer.bikes.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Registered Bikes</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.bikes.map((b, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-sm">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedCustomer.vehicles && selectedCustomer.vehicles.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Vehicle Numbers</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.vehicles.map((v, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-50 text-blue-800 rounded-lg text-sm">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedCustomer(null)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
