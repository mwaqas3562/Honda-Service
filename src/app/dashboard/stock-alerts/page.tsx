"use client";

import PageHeader from "@/components/PageHeader";
import LowStockAlerts from "@/components/LowStockAlerts";

export default function StockAlertsPage() {
  return (
    <>
      <PageHeader
        title="Smart Stock Alerts"
        description="Predictive stock alerts based on sales trends"
      />
      <LowStockAlerts variant="inventory" />
    </>
  );
}
